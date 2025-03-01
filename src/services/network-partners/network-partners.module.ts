import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchemaMapperService } from '@robinydv/schema-mapper';
import { NetworkPartnerFactoryService } from './factory/network-partner-factory.service';
import { EndpointConfigModule } from 'src/common/repositories/endpoint-configs/endpoint-configs.module';
import { networkPartnersProviders } from './network-partners.provider';
import { StatusTrackingModule } from 'src/common/repositories/status-tracking/status-tracking.module';
import { StatusTrackingLogsModule } from 'src/common/repositories/status-tracking-logs/status-tracking-logs.module';
import { BigshipModule } from './implementation/bigship/bigship.module';
/**
 * Module for network partners
 */
@Module({
    imports: [
        HttpModule,
        ConfigModule,
        BigshipModule,
        EndpointConfigModule,
        StatusTrackingModule,
        StatusTrackingLogsModule,
    ],
    providers: [
        NetworkPartnerFactoryService,
        SchemaMapperService,
        ...networkPartnersProviders,
    ],
    exports: [NetworkPartnerFactoryService],
})
export class NetworkPartnersModule { } 