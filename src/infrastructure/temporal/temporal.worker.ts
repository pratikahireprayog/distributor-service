import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Worker } from '@temporalio/worker';
import { TASK_QUEUE_CONST } from './temporal.constant';
import { ActivityRegistryService } from './activities/activity-registry.service';

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
    constructor(
        private readonly activityRegistry: ActivityRegistryService,
    ) { }

    /**
     * Lifecycle hook that runs when the module is initialized
     */
    async onModuleInit() {
        try {
            // Create and start Temporal worker
            this.worker = await Worker.create({
                activities: this.activityRegistry.getActivities(),
                taskQueue: TASK_QUEUE_CONST.DISTRIBUTOR_SERVICE_TASK_QUEUE,
            });

            // Start the worker
            this.logger.log('Starting Temporal worker...');

            // Run the worker in the background
            this.worker.run().catch((error) => {
                this.logger.error('Temporal worker failed:', error);
            });

            this.logger.log('Temporal worker started successfully');
        } catch (error) {
            this.logger.warn('Failed to start Temporal worker. Is the Temporal server running?', error);
        }
    }

    /**
     * Lifecycle hook that runs when the module is destroyed
     */
    async onModuleDestroy() {
        // Shutdown the worker gracefully
        if (this.worker) {
            this.logger.log('Shutting down Temporal worker...');
            await this.worker.shutdown();
            this.logger.log('Temporal worker shut down successfully');
        }
    }
} 