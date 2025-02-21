import { LoggerService } from '@nestjs/common';
import { trace, context } from '@opentelemetry/api';
import * as winston from 'winston';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LokiTransport = require('winston-loki');

export class NestWinstonLogger implements LoggerService {
  private serviceName: string;
  private logger: winston.Logger;

  constructor(serviceName: string) {
    this.serviceName = serviceName;

    this.setLogger();

    // Override console methods
    console.log = (message: string) => {
      this.logger.info(message);
    };
    console.error = (message: string) => {
      this.logger.error(message);
    };
    console.warn = (message: string) => {
      this.logger.warn(message);
    };
    console.debug = (message: string) => {
      this.logger.debug(message);
    };
  }

  private getConfig() {
    return {
      host: 'http://localhost:3100', // replace with your Loki instance URL
      json: true,
      labels: { job: this.serviceName }, // replace with your labels
      handleExceptions: true,
    };
  }

  private setLogger() {
    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.printf((info) => {
        const span = trace.getSpan(context.active());
        const traceId = span ? span.spanContext().traceId : '';
        const spanId = span ? span.spanContext().spanId : '';
        info.traceId = traceId ? ` traceId=${traceId}` : '';
        info.spanId = spanId ? ` spanId=${spanId}` : '';

        return `${info.level}: ${info.message} ${info.traceId} ${info.spanId}`;
      }),
      transports: [new LokiTransport(this.getConfig()), new winston.transports.Console()],
      exitOnError: false,
    });
  }

  log(message: string) {
    this.logger.info(message);
  }

  error(message: string, trace: string) {
    this.logger.error(message, { trace });
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }

  data(message: string) {
    this.logger.data(message);
  }

  prompt(message: string) {
    this.logger.prompt(message);
  }

  input(message: string) {
    this.logger.input(message);
  }

  silly(message: string) {
    this.logger.silly(message);
  }
}

// Loki Configurations
// new LokiTransport({
//       host: 'http://localhost:3100',
//       interval: 30,
//       json: true,
//       batching: true,
//       clearOnError: true,
//       replaceTimestamp: true,
//       labels: { module: 'http' },
//       format: winston.format.simple(),
//       gracefulShutdown: true,
//       timeout: 30000,
//       basicAuth: 'username:password',
//       onConnectionError: (err) => console.error(err),
//     }),

// winston.format.printf((info) => {
//   const span = trace.getSpan(context.active());
//   const traceId = span ? span.spanContext().traceId : '';
//   const spanId = span ? span.spanContext().spanId : '';
//   return `${info.level}: ${info.message} traceId=${traceId} spanId=${spanId}`});

// format: winston.format.combine(winston.format.colorize({ level: true }), winston.format.json()),
