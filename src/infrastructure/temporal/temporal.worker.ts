import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { NativeConnection, Worker } from "@temporalio/worker";
import { TASK_QUEUE_CONST } from "./temporal.constant";
import { ActivityRegistryService } from "./activities/activity-registry.service";
import { ENV_TYPE_CONST } from "../telemetry/telemetry.constant";

/**
 * Service for managing Temporal workers
 */
/**
 * Service for managing Temporal workers
 */
@Injectable()
export class TemporalWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(TemporalWorker.name);

  /**
   * Constructor for TemporalWorker
   * @param activityRegistry The activity registry service
   */
  constructor(private readonly activityRegistry: ActivityRegistryService) {}

  /**
   * Check if running in development environment
   */
  private isDevEnvironment(): boolean {
    const envType = process.env.ENV_TYPE || ENV_TYPE_CONST.DEV;
    return envType === ENV_TYPE_CONST.DEV;
  }

  /**
   * Lifecycle hook that runs when the module is initialized
   */
  async onModuleInit() {
    try {
      // Wait a bit for activities to be registered
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const activities = this.activityRegistry.getActivities();
      if (Object.keys(activities).length === 0) {
        this.logger.warn(
          "No activities registered. Worker will not be started."
        );
        return;
      }

      // Get environment type
      const isDevEnv = this.isDevEnvironment();
      const envType = process.env.ENV_TYPE || ENV_TYPE_CONST.DEV;

      // Get Temporal address from environment or set default
      const defaultAddress = isDevEnv
        ? "localhost:7233"
        : process.env.TEMPORAL_CLOUD_ADDRESS;
      const temporalAddress = process.env.TEMPORAL_ADDRESS || defaultAddress;

      // Get namespace from environment variable or use default
      const defaultNamespace = "default";
      const namespace = isDevEnv
        ? defaultNamespace
        : process.env.TEMPORAL_NAMESPACE;

      // Check if we're using local Temporal server even in QA/PROD
      const isLocalTemporal = temporalAddress === "localhost:7233";

      this.logger.log(
        `Environment: ${isDevEnv ? "Development" : "Production/QA"}`
      );
      this.logger.log(`Connecting to Temporal server at ${temporalAddress}...`);
      this.logger.log(`Using Temporal namespace: ${namespace}`);

      // Configure connection options based on environment and address
      let connectionOptions: any;

      if (isDevEnv || isLocalTemporal) {
        // Simple connection for development environment or local Temporal in any env
        this.logger.log(
          `Using local Temporal configuration (${isDevEnv ? "DEV env" : "local address in " + envType + " env"})`
        );
        connectionOptions = {
          address: temporalAddress,
        };
      } else {
        // Cloud connection configuration for non-dev environments with cloud address
        this.logger.log("Using cloud Temporal configuration");
        connectionOptions = {
          address: temporalAddress,
          tls: true, // Always true for Temporal Cloud
          apiKey: process.env.TEMPORAL_API_KEY, // Direct apiKey parameter
          metadata: {
            "temporal-namespace": namespace, // Required for routing
          },
        };
      }

      // Connect to Temporal server with environment-specific configuration
      const connection = await NativeConnection.connect(connectionOptions);

      this.logger.log(
        `Successfully connected to Temporal server at ${temporalAddress}`
      );

      // Create and start Temporal worker with registered activities
      this.worker = await Worker.create({
        connection,
        activities,
        taskQueue: TASK_QUEUE_CONST.DISTRIBUTOR_SERVICE_TASK_QUEUE,
        namespace: namespace,
        // High-performance activity execution settings
        maxConcurrentActivityTaskExecutions: 1000, // Max activities at once - set high for throughput
        maxConcurrentActivityTaskPolls: 100, // Max concurrent polls for activities - set high
        maxActivitiesPerSecond: 0, // Worker-side rate limit - 0 means no limit (unlimited)
        maxTaskQueueActivitiesPerSecond: 0, // Server-side rate limit - 0 means no limit (unlimited)
        // Keep default workflow settings
        // maxConcurrentWorkflowTaskExecutions: 50,  // Default is 50
      });

      // Start the worker
      this.logger.log(
        `Starting Temporal worker on task queue: ${TASK_QUEUE_CONST.DISTRIBUTOR_SERVICE_TASK_QUEUE}...`
      );
      this.logger.log(
        `Registered activities: ${Object.keys(activities).join(", ")}`
      );

      // Run the worker
      this.worker.run().catch((error) => {
        this.logger.error("Temporal worker failed:", error);
        throw error;
      });

      this.logger.log("Temporal worker started successfully");
    } catch (error) {
      this.logger.error("Failed to start Temporal worker:", error);
      this.logger.warn(
        "Is the Temporal server running at the configured address?"
      );
      this.logger.warn(
        "Check your TEMPORAL_ADDRESS environment variable or server configuration"
      );
      this.logger.warn(
        "For Temporal Cloud, ensure TEMPORAL_API_KEY and TEMPORAL_NAMESPACE are set correctly"
      );
      throw error;
    }
  }

  /**
   * Lifecycle hook that runs when the module is destroyed
   */
  /**
   * Lifecycle hook that runs when the module is destroyed
   */
  async onModuleDestroy() {
    // Shutdown the worker gracefully
    if (this.worker) {
      this.logger.log("Shutting down Temporal worker...");
      await this.worker.shutdown();
      this.logger.log("Temporal worker shut down successfully");
    }
  }
}
