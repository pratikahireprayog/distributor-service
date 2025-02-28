// import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
// import { Worker } from '@temporalio/worker';
// // import * as activities from './activities/delivery-partner.activities';
// // import { deliveryPartnerWorkflow } from './workflows/delivery-partner.workflow';

// @Injectable()
// export class TemporalService implements OnModuleInit, OnModuleDestroy {
//     private worker: Worker;
//     private readonly logger = new Logger(TemporalService.name);

//     async onModuleInit() {
//         try {
//             // Create and start Temporal worker
//             this.worker = await Worker.create({
//                 workflowsPath: require.resolve('./workflows/delivery-partner.workflow'),
//                 // activities,
//                 taskQueue: 'delivery-partner-taskqueue',
//             });

//             // Start the worker
//             this.logger.log('Starting Temporal worker...');

//             // Run the worker in the background
//             this.worker.run().catch((error) => {
//                 this.logger.error('Temporal worker failed:', error);
//             });

//             this.logger.log('Temporal worker started successfully');
//         } catch (error) {
//             this.logger.warn('Failed to start Temporal worker. Is the Temporal server running?', error);
//         }
//     }

//     async onModuleDestroy() {
//         // Shutdown the worker gracefully
//         if (this.worker) {
//             this.logger.log('Shutting down Temporal worker...');
//             await this.worker.shutdown();
//             this.logger.log('Temporal worker shut down successfully');
//         }
//     }
// } 