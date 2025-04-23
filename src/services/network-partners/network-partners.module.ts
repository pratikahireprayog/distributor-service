import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NetworkPartnerFactoryService } from './factory/network-partner-factory.service';
import { EndpointConfigModule } from 'src/common/repositories/endpoint-configs/endpoint-configs.module';
import { networkPartnersProviders } from './network-partners.provider';
import { BigshipModule } from './implementation/bigship/bigship.module';
import { TsawModule } from './implementation/tsaw/tsaw.module';
import { SchemaMapperService } from 'src/infrastructure/schema-mapper';
import { DefaultNetworkPartnerModule } from './implementation/default/default-network-partner.module';
/**
 * Module for network partners
 */
@Module({
    imports: [
        HttpModule,
        ConfigModule,
        BigshipModule,
        TsawModule,
        DefaultNetworkPartnerModule,
        EndpointConfigModule
    ],
    providers: [
        NetworkPartnerFactoryService,
        ...networkPartnersProviders,
        SchemaMapperService
    ],
    exports: [NetworkPartnerFactoryService, SchemaMapperService],
})
export class NetworkPartnersModule { } 