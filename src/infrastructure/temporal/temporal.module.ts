import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DistributorModule } from '../../services/distributor/distributor.module';
import { ActivityRegistryService } from './activities/activity-registry.service';
import { TemporalWorker } from './temporal.worker';

/**
 * Module for Temporal integration
 */
@Module({
    imports: [
        ConfigModule,
        DistributorModule,
    ],
    providers: [
        TemporalWorker,
        ActivityRegistryService,
        Logger,
    ],
    exports: [
        TemporalWorker,
        ActivityRegistryService,
    ],
})
export class TemporalModule { } 