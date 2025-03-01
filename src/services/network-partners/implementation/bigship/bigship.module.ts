import { HttpModule } from '@nestjs/axios';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SchemaMapperService } from '@robinydv/schema-mapper';
import { BigshipAuthService } from './bigship-auth.service';
import { BigshipService } from './bigship.service';
import { StatusTrackingModule } from 'src/common/repositories/status-tracking/status-tracking.module';
import { StatusTrackingLogsModule } from 'src/common/repositories/status-tracking-logs/status-tracking-logs.module';
import { EndpointConfigModule } from 'src/common/repositories/endpoint-configs/endpoint-configs.module';
/**
 * Module for Bigship integration
 */
@Module({
    imports: [
        HttpModule,
        ConfigModule,
        StatusTrackingModule,
        StatusTrackingLogsModule,
        EndpointConfigModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'default-secret',
            signOptions: { expiresIn: '1h' },
        }),
    ],
    providers: [
        BigshipService,
        BigshipAuthService,
        Logger,
        SchemaMapperService
    ],
    exports: [BigshipService, BigshipAuthService]
})
export class BigshipModule { } 