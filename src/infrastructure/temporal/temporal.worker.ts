import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
  Inject,
} from "@nestjs/common";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as mongoose from "mongoose";

import { TASK_QUEUE_CONST } from "./temporal.constant";
import { ActivityRegistryService } from "./activities/activity-registry.service";
import { ENV_TYPE_CONST } from "../telemetry/telemetry.constant";
import { RepositoryConst } from "../../common"; // adjust path if needed

@Injectable()
export class TemporalWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(TemporalWorker.name);

  constructor(
    private readonly activityRegistry: ActivityRegistryService,

    // 🔑 IMPORTANT: Inject the DB used by EndpointConfigs
    @Inject(RepositoryConst.DATABASE_NAME_CONST.DISTRIBUTOR_DB)
    private readonly distributorDbConn: mongoose.Connection
  ) {}

  private isDevEnvironment(): boolean {
    const envType = process.env.ENV_TYPE || ENV_TYPE_CONST.DEV;
    return envType === ENV_TYPE_CONST.DEV;
  }

  async onModuleInit() {
  try {
    // -------------------------
    // 🔥 HARD GATE: DB FIRST
    // -------------------------
    this.logger.log("Waiting for MongoDB connection...");
    await this.distributorDbConn.asPromise();
    this.logger.log("MongoDB connected");

    // -------------------------
    // REGISTER ACTIVITIES
    // -------------------------
    const activities = this.activityRegistry.getActivities();

    if (Object.keys(activities).length === 0) {
      this.logger.warn("No activities registered. Worker will not start.");
      return;
    }

    const isDevEnv = this.isDevEnvironment();
    const envType = process.env.ENV_TYPE || ENV_TYPE_CONST.DEV;

    const temporalAddress =
      process.env.TEMPORAL_ADDRESS ||
      (isDevEnv ? "localhost:7233" : process.env.TEMPORAL_CLOUD_ADDRESS);

    const namespace = isDevEnv
      ? "default"
      : process.env.TEMPORAL_NAMESPACE;

    this.logger.log(`ENV_TYPE: ${envType}`);
    this.logger.log(`Temporal Address: ${temporalAddress}`);
    this.logger.log(`Temporal Namespace: ${namespace}`);

    // -------------------------
    // TEMPORAL CONNECTION CONFIG
    // -------------------------
    let connectionOptions: any;

    if (isDevEnv || temporalAddress === "localhost:7233") {
      connectionOptions = { address: temporalAddress };
    } else {
      connectionOptions = {
        address: temporalAddress,
        tls: true,
        apiKey: process.env.TEMPORAL_API_KEY,
        metadata: {
          "temporal-namespace": namespace,
        },
      };
    }

    // -------------------------
    // CONNECT TO TEMPORAL
    // -------------------------
    const connection = await NativeConnection.connect(connectionOptions);
    this.logger.log("Connected to Temporal successfully");

    // -------------------------
    // CREATE WORKER
    // -------------------------
    this.worker = await Worker.create({
      connection,
      activities,
      taskQueue: TASK_QUEUE_CONST.DISTRIBUTOR_SERVICE_TASK_QUEUE,
      namespace,
    });

    // -------------------------
    // START WORKER (BLOCKING)
    // -------------------------
    this.logger.log(
      `Starting Temporal worker on task queue: ${TASK_QUEUE_CONST.DISTRIBUTOR_SERVICE_TASK_QUEUE}`
    );

    await this.worker.run();
  } catch (error) {
    this.logger.error("Failed to start Temporal worker", error);
    throw error; // fail fast → ECS restarts task
  }
}


  async onModuleDestroy() {
    if (this.worker) {
      this.logger.log("Shutting down Temporal worker...");
      await this.worker.shutdown();
      this.logger.log("Temporal worker shut down cleanly");
    }
  }
}
