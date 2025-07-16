import {
  Logger,
  MiddlewareConsumer,
  Module,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NestLoggerMiddleware } from './infrastructure/telemetry/logger/logger.middleware';
import { TraceMiddleware } from './infrastructure/telemetry/otel.middleware';
import { DatabaseModule } from './infrastructure/database/database.module';
import { TemporalModule } from './infrastructure/temporal/temporal.module';
import { DistributorModule } from './services/distributor/distributor.module';
import { NetworkPartnersModule } from './services/network-partners/network-partners.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    TemporalModule,
    DistributorModule,
    NetworkPartnersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(NestLoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
    consumer
      .apply(TraceMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
