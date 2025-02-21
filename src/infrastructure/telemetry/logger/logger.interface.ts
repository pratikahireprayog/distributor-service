import * as winston from 'winston';
import { LOG_LEVELS_CONST } from 'src/infrastructure/telemetry/telemetry.constant';

export interface NestLoggerConfigDataModel {
  logTransporters: winston.transport[];
  loggerConfigDataModel: LoggerConfigDataModel;
  lokiTransporterConfigDataModel: LokiTransporterConfigDataModel;
}

export interface LokiTransporterConfigDataModel {
  host: string;
  interval?: number;
  json?: boolean;
  batching?: boolean;
  clearOnError?: boolean;
  replaceTimestamp?: boolean;
  labels: { exported_job: string; service_name: string };
  gracefulShutdown?: boolean;
  timeout?: number;
  basicAuth?: string;
  handleExceptions: boolean;
  onConnectionError: (err: any) => void;
}

export interface LoggerConfigDataModel {
  level: LOG_LEVELS_CONST.DEBUG;
  format: winston.Logform.Format;
  transports: winston.transport[];
  exitOnError: boolean;
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
