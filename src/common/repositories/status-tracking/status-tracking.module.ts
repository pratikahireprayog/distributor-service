import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/infrastructure/database/database.module';
import { StatusTrackingRepository } from './status-tracking.repository';
import { statusTrackingProviders } from './status-tracking.provider';

@Module({
    imports: [DatabaseModule],
    providers: [...statusTrackingProviders, StatusTrackingRepository],
    exports: [StatusTrackingRepository],
})
export class StatusTrackingModule { } 