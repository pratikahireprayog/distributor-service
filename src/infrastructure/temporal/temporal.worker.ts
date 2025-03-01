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
            // Wait a bit for activities to be registered
            await new Promise(resolve => setTimeout(resolve, 1000));

            const activities = this.activityRegistry.getActivities();
            if (Object.keys(activities).length === 0) {
                this.logger.warn('No activities registered. Worker will not be started.');
                return;
            }

            // Create and start Temporal worker with registered activities
            this.worker = await Worker.create({
                activities,
                taskQueue: TASK_QUEUE_CONST.DISTRIBUTOR_SERVICE_TASK_QUEUE,
            });

            // Start the worker
            this.logger.log(`Starting Temporal worker with activities: ${Object.keys(activities).join(', ')}`);

            // Run the worker
            this.worker.run().catch((error) => {
                this.logger.error('Temporal worker failed:', error);
                throw error;
            });

            this.logger.log('Temporal worker started successfully');
        } catch (error) {
            this.logger.error('Failed to start Temporal worker:', error);
            throw error;
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