import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DistributorModule } from '../../services/distributor/distributor.module';
import { ActivityRegistrationProvider } from './activities/activity-registration.provider';
import { ActivityRegistryService } from './activities/activity-registry.service';
import { TemporalWorker } from './temporal.worker';
import { DatabaseModule } from '../database/database.module';

/**
 * Module for Temporal integration
 */
@Module({
    imports: [
        ConfigModule,
        DistributorModule,
        DatabaseModule
    ],
    providers: [
        TemporalWorker,
        ActivityRegistryService,
        ActivityRegistrationProvider,
        Logger,
    ],
    exports: [
        TemporalWorker,
        ActivityRegistryService,
    ],
})
export class TemporalModule { } 