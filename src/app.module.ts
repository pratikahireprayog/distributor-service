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

@Module({
  imports: [
    DatabaseModule,
    TemporalModule,
  ],
  controllers: [AppController],
  providers: [AppService, Logger],
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
