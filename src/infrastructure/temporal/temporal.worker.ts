import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Worker } from '@temporalio/worker';
import { BigshipActivity } from 'src/services/activities/bigship-activity/bigship.activity';
import { TASK_QUEUE_CONST } from './temporal.constant';

@Injectable()
export class TemporalWorker implements OnModuleInit, OnModuleDestroy {
    private worker: Worker;
    private readonly logger = new Logger(TemporalWorker.name);

    constructor(private readonly bigshipActivity: BigshipActivity) { }

    async onModuleInit() {
        try {
            // Create and start Temporal worker
            this.worker = await Worker.create({
                activities: {
                    bigshipOrderManifestationActivity: this.bigshipActivity.manifestOrder.bind(this.bigshipActivity)
                },
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

    async onModuleDestroy() {
        // Shutdown the worker gracefully
        if (this.worker) {
            this.logger.log('Shutting down Temporal worker...');
            await this.worker.shutdown();
            this.logger.log('Temporal worker shut down successfully');
        }
    }
} 