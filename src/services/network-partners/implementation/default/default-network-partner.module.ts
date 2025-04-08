import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EndpointConfigModule } from 'src/common/repositories/endpoint-configs/endpoint-configs.module';
import { DefaultNetworkPartner } from './default-network-partner.service';
import { DefaultAuthService } from './default-auth.service';
import { SchemaMapperService } from 'src/infrastructure/schema-mapper';

/**
 * Module for the default network partner
 */
@Module({
  imports: [
    HttpModule,
    EndpointConfigModule
  ],
  providers: [
    DefaultNetworkPartner,
    DefaultAuthService,
    SchemaMapperService
  ],
  exports: [
    DefaultNetworkPartner,
    DefaultAuthService
  ]
})
export class DefaultNetworkPartnerModule {} 