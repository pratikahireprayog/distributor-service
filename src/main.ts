import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { startOtel, LoggerFactory } from 'src/infrastructure/telemetry';
import { GlobalConst } from './common';

async function bootstrap() {
  // Start Opentelemetry
  startOtel(GlobalConst.SERVICE_NAME);

  const loggerFactory = new LoggerFactory(GlobalConst.SERVICE_NAME);
  const logger = loggerFactory.createLogger();

  // Create NestJS application without HTTP server
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: logger,
  });

  // Log that the worker is running
  logger.log(`Distributor Service Temporal Worker is running`);

  // Handle shutdown signals
  process.on('SIGINT', async () => {
    logger.log('Received SIGINT signal, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM signal, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
