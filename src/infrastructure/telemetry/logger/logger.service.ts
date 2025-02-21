import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { LoggerConfigDataModelFactory } from './logger.factory';
import { NestLoggerConfigDataModel } from './logger.interface';

export class NestWinstonLogger implements LoggerService {
  private logger: winston.Logger;
  private loggerConfig: NestLoggerConfigDataModel;

  constructor(serviceName: string) {
    const loggerFactory = new LoggerConfigDataModelFactory(serviceName);
    this.loggerConfig = loggerFactory.createLoggerConfigDataModel();
    this.setLogger();

    // Override console methods
    // console.log = (...args: any[]) => {
    //   const message = this.splitArgs(args);
    //   this.logger.info(message, args);
    // };
    // console.error = (...args: any[]) => {
    //   const message = this.splitArgs(args);
    //   this.logger.error(message, args);
    // };
    // console.warn = (...args: any[]) => {
    //   this.logger.warn(args);
    // };
    // console.debug = (...args: any[]) => {
    //   this.logger.debug(args);
    // };
  }

  private splitArgs(args: any[]) {
    return args
      .map((arg) => {
        if (typeof arg === 'object' && arg !== null) {
          return JSON.stringify(arg, null, 2);
        }
        return arg;
      })
      .join(' ');
  }

  private setLogger() {
    this.logger = winston.createLogger({
      level: this.loggerConfig.loggerConfigDataModel.level,
      format: this.loggerConfig.loggerConfigDataModel.format,
      transports: this.loggerConfig.loggerConfigDataModel.transports,
      exitOnError: this.loggerConfig.loggerConfigDataModel.exitOnError,
    });
  }

  log(...args: any[]) {
    const message = this.splitArgs(args);
    this.logger.info(message, args);
  }

  error(...args: any[]) {
    const message = this.splitArgs(args);
    this.logger.error(message, args);
  }

  warn(...args: any[]) {
    const message = this.splitArgs(args);
    this.logger.warn(message, args);
  }

  debug(...args: any[]) {
    const message = this.splitArgs(args);
    this.logger.debug(message, args);
  }

  verbose(...args: any[]) {
    const message = this.splitArgs(args);
    this.logger.verbose(message, args);
  }

  data(...args: any[]) {
    const message = this.splitArgs(args);
    this.logger.data(message, args);
  }

  prompt(...args: any[]) {
    const message = this.splitArgs(args);
    this.logger.prompt(message, args);
  }

  input(...args: any[]) {
    const message = this.splitArgs(args);
    this.logger.input(message, args);
  }

  silly(...args: any[]) {
    const message = this.splitArgs(args);
    this.logger.silly(message, args);
  }
}
