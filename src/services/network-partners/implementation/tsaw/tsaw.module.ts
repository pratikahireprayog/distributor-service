import { HttpModule } from '@nestjs/axios';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SchemaMapperService } from 'src/infrastructure/schema-mapper';
import { TsawAuthService } from './tsaw-auth.service';
import { TsawService } from './tsaw.service';
import { EndpointConfigModule } from 'src/common/repositories/endpoint-configs/endpoint-configs.module';

@Module({
    imports: [
        HttpModule,
        ConfigModule,
        EndpointConfigModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'default-secret',
            signOptions: { expiresIn: '1h' },
        }),
    ],
    providers: [
        TsawService,
        TsawAuthService,
        Logger,
        SchemaMapperService
    ],
    exports: [TsawService, TsawAuthService]
})
export class TsawModule { } 