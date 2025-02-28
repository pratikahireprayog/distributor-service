import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/infrastructure/database/database.module';
import { StatusTrackingLogsRepository } from './status-tracking-logs.repository';
import { statusTrackingLogsProviders } from './status-tracking-logs.provider';

@Module({
    imports: [DatabaseModule],
    providers: [StatusTrackingLogsRepository, ...statusTrackingLogsProviders],
    exports: [StatusTrackingLogsRepository],
})
export class StatusTrackingLogsModule { } 