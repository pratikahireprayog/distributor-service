import { NestWinstonLogger } from './logger.service';
import { NestWinstonLoggerConfig } from './logger.config';
import { NestLoggerConfigDataModel } from './logger.interface';

export class LoggerFactory {
  private serviceName: string;
  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }
  createLogger() {
    return new NestWinstonLogger(this.serviceName);
  }
}

export class LoggerConfigDataModelFactory {
  private serviceName: string;
  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }
  createLoggerConfigDataModel(): NestLoggerConfigDataModel {
    const loggerConfig: NestWinstonLoggerConfig = new NestWinstonLoggerConfig(
      this.serviceName,
    );
    return loggerConfig.nestLoggerConfigDataModel;
  }
}
