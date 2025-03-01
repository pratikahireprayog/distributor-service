import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EndpointConfigRepository } from './endpoint-configs.repository';
import { EndpointConfigSchema } from './endpoint-configs.schema';
import { DatabaseModule } from 'src/infrastructure/database/database.module';
import { endpointConfigProviders } from './endpoint-configs-provider';

@Module({
    imports: [
        DatabaseModule,
    ],
    providers: [
        ...endpointConfigProviders,
        EndpointConfigRepository
    ],
    exports: [EndpointConfigRepository]
})
export class EndpointConfigModule { } 