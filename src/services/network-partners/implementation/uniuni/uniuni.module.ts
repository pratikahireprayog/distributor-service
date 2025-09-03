import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { UniuniService } from './uniuni.service';
import { UniuniAuthService } from './uniuni-auth.service';
import { UniuniFactoryService } from './uniuni-factory.service';
import { EndpointConfigModule } from 'src/common/repositories/endpoint-configs/endpoint-configs.module';
import { SchemaMapperModule } from 'src/infrastructure/schema-mapper/schema-mapper.module';

@Module({
  imports: [HttpModule, ConfigModule, EndpointConfigModule, SchemaMapperModule],
  providers: [UniuniService, UniuniAuthService, UniuniFactoryService],
  exports: [UniuniService, UniuniAuthService, UniuniFactoryService],
})
export class UniuniModule {}
