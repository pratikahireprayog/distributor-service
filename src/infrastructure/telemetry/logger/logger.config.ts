import { trace, context } from '@opentelemetry/api';
import * as winston from 'winston';

import { isProdEnv } from '../otel-life-cycle';
import {
  LoggerConfigDataModel,
  LokiTransporterConfigDataModel,
  NestLoggerConfigDataModel,
} from './logger.interface';

import {
  OTEL_ENV_CONST,
  OTEL_PORT_CONST,
  LOG_CONFIG_CONST,
  LOG_LEVELS_CONST,
} from 'src/infrastructure/telemetry/telemetry.constant';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LokiTransport = require('winston-loki');

export class NestWinstonLoggerConfig {
  private serviceName: string;
  private logExporterURL: string;
  private _nestLoggerConfigDataModel: NestLoggerConfigDataModel;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this._nestLoggerConfigDataModel = {
      logTransporters: [],
      loggerConfigDataModel: {} as LoggerConfigDataModel,
      lokiTransporterConfigDataModel: {} as LokiTransporterConfigDataModel,
    };
    this.setLogExporterURL();
    this.setLokiTranspoterConfig();
    this.setLogTransporters();
    this.setLoggerConfig();
  }

  get nestLoggerConfigDataModel() {
    return this._nestLoggerConfigDataModel;
  }

  private setLogExporterURL() {
    try {
      this.logExporterURL =
        process.env[OTEL_ENV_CONST.OTEL_BASE_URL] +
        ':' +
        (process.env[OTEL_ENV_CONST.OTEL_LOG_EXPORTER_PORT] ??
          OTEL_PORT_CONST.OTEL_LOG_EXPORTER_PORT);
    } catch (error) {
      console.error(
        `Failed to get env variable OTEL_BASE_URL or OTEL_LOG_PORT: ${error.message}`,
      );
    }
  }

  private setLokiTranspoterConfig() {
    this._nestLoggerConfigDataModel.lokiTransporterConfigDataModel = {
      host: this.logExporterURL,
      interval: LOG_CONFIG_CONST.INTERVAL,
      json: true,
      batching: true,
      labels: {
        exported_job: this.serviceName,
        service_name: this.serviceName,
      },
      gracefulShutdown: true,
      handleExceptions: true,
      timeout: LOG_CONFIG_CONST.TIMEOUT,
      onConnectionError: (err) => console.error(err),
    };
  }

  private setLogTransporters() {
    if (isProdEnv()) {
      console.log(
        'This is a PROD environment, so setting LogTransporter for logging.',
      );
      this._nestLoggerConfigDataModel.logTransporters.push(
        new LokiTransport(
          this._nestLoggerConfigDataModel.lokiTransporterConfigDataModel,
        ),
      );
    }
    console.log('Setting ConsoleTransporter for logger.');
    this._nestLoggerConfigDataModel.logTransporters.push(
      new winston.transports.Console(),
    );
  }
  private setLoggerConfig() {
    this._nestLoggerConfigDataModel.loggerConfigDataModel = {
      level: LOG_LEVELS_CONST.DEBUG,
      format: winston.format.printf((info) => {
        const span = trace.getSpan(context.active());
        const traceId = span ? span.spanContext().traceId : '';
        const spanId = span ? span.spanContext().spanId : '';
        info.traceId = traceId ? `${traceId}` : '';
        info.spanId = spanId ? `${spanId}` : '';
        return `${info.level}: serviceName: ${this.serviceName} ${info.message} ${info.traceId} ${info.spanId}`;
      }),
      transports: this._nestLoggerConfigDataModel.logTransporters,
      exitOnError: false,
    };
  }
}

// winston.format.printf((info) => {
//   const span = trace.getSpan(context.active());
//   const traceId = span ? span.spanContext().traceId : '';
//   const spanId = span ? span.spanContext().spanId : '';
//   return `${info.level}: ${info.message} traceId=${traceId} spanId=${spanId}`});

// format: winston.format.combine(winston.format.colorize({ level: true }), winston.format.json()),

// export class NestWinstonLoggerConfigFactory {
//   public getConfigDataModel(serviceName: string): NestLoggerConfigDataModel {
//     let _nestLoggerConfigDataModel: NestLoggerConfigDataModel;

//     // _nestLoggerConfigDataModel.serviceName = serviceName;
//     // _nestLoggerConfigDataModel.logExporterUrl = this.getLogExporterURL();
//     _nestLoggerConfigDataModel.lokiTransporterConfigDataModel = this.getLokiTranspoterConfig(serviceName);
//     _nestLoggerConfigDataModel.logTransporters = this.getLogTransporters(_nestLoggerConfigDataModel.lokiTransporterConfigDataModel);
//     _nestLoggerConfigDataModel.loggerConfigDataModel = this.getLoggerConfig(_nestLoggerConfigDataModel.logTransporters);
//     return _nestLoggerConfigDataModel;
//   }

//   private getLogExporterURL(): string {
//     try {
//       return process.env[OTEL_ENV_CONST.OTEL_BASE_URL] + ':' + (process.env[OTEL_ENV_CONST.OTEL_LOG_PORT] ?? OTEL_PORT_CONST.OTEL_LOG_PORT);
//     } catch (error) {
//       console.error(`Failed to get env variable OTEL_BASE_URL or OTEL_LOG_PORT: ${error.message}`);
//       return '';
//     }
//   }

//   private getLokiTranspoterConfig(serviceName: string): LokiTransporterConfigDataModel {
//     const host = this.getLogExporterURL();
//     return {
//       host: host,
//       interval: Log_CONFIG_CONST.INTERVAL,
//       json: true,
//       batching: true,
//       labels: { exported_job: serviceName, service_name: serviceName },
//       gracefulShutdown: true,
//       handleExceptions: true,
//       timeout: Log_CONFIG_CONST.TIMEOUT,
//       onConnectionError: (err) => console.error(err),
//     };
//   }

//   private getLogTransporters(lokiTransporterConfigDataModel: LokiTransporterConfigDataModel): winston.transport[] {
//     if (!isProdEnv()) {
//       console.log('This is not a PROD environment, so setting ConsoleTransporter for logger.');
//       return [new winston.transports.Console()];
//     }

//     console.log('This is a PROD environment, so setting LogTransporter for logging.');
//     return [new LokiTransport(lokiTransporterConfigDataModel)];
//   }
//   private getLoggerConfig(logTranspors: winston.transport[]): LoggerConfigDataModel {
//     return {
//       level: LOG_LEVELS_CONST.DEBUG,
//       format: winston.format.printf((info) => {
//         const span = trace.getSpan(context.active());
//         const traceId = span ? span.spanContext().traceId : '';
//         const spanId = span ? span.spanContext().spanId : '';
//         info.traceId = traceId ? ` traceId=${traceId}` : '';
//         info.spanId = spanId ? ` spanId=${spanId}` : '';
//         return `${info.level}: ${info.message} ${info.traceId} ${info.spanId}`;
//       }),
//       transports: logTranspors,
//       exitOnError: false,
//     };
//   }
// }
