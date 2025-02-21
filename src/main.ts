import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { startOtel, LoggerFactory } from 'src/infrastructure/telemetry';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { GlobalConst } from './common';
import {
  CustomHttpExceptionFilter,
  GlobalExceptionFilter,
} from './infrastructure/exception-handlers';
import { CallbackProviderTypeEnum } from './common/enums';
import { json, urlencoded } from 'express';

declare const module: any;

async function bootstrap() {
  // Start Opentelemetry
  startOtel('distributor-service');

  const loggerFactory = new LoggerFactory('distributor-service');
  const logger = loggerFactory.createLogger();

  const app = await NestFactory.create(AppModule, {
    // bufferLogs: true,
    logger: logger,
  });

  app.enableCors();
  app.setGlobalPrefix('distributor');

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalFilters(new CustomHttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  // Increase JSON payload size limit to 10mb
  // app.use(json({ limit: '10mb' }));

  // Increase URL-encoded payload size limit to 10mb
  // app.use(urlencoded({ extended: true, limit: '10mb' }));

  const port = process.env.PORT || 3000;
  await app.listen(port, () => {
    logger.log(`Distributor Service listening at http://localhost:${port}`);
  });

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
