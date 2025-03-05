import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as path from 'path';
import { CustomHttpException } from './exception-handler.exception';
import { BaseResDto } from 'src/common/dtos/base.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Check if the exception is already in BaseResDto format
    if (exception instanceof BaseResDto) {
      this.logger.error(
        `Error occurred: ${exception.message}`,
        JSON.stringify(exception),
        'GlobalExceptionFilter',
      );
      return response.status(status).json(exception);
    }

    // Create a standardized error response in BaseResDto format
    const errorResponse = new BaseResDto();
    errorResponse.statusCode = status;
    errorResponse.message = message;
    errorResponse.data = null;

    // Build a comprehensive trace with all available information
    errorResponse.trace = {
      timestamp: new Date().toISOString(),
      // path: request.url,
      // method: request.method,
      // statusCode: status,
      // error: exception instanceof HttpException ? exception.name : 'Internal Server Error',
      // stack: exception instanceof Error ? exception.stack : '',
      // Include the original response data if available
      responseData: exception['response']?.data || exception['response'] || null,
      // Include any additional context that might have been added
      context: exception['context'] || null
    };

    // Log the detailed error
    this.logger.error(
      `Error occurred: ${message}`,
      JSON.stringify(errorResponse),
      'GlobalExceptionFilter',
    );

    // Send response to client
    response.status(status).json(errorResponse);
  }
}

@Catch(CustomHttpException)
export class CustomHttpExceptionFilter implements ExceptionFilter {
  catch(exception: CustomHttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    // const request = ctx.getRequest();
    const status = exception.getStatus();
    const message = exception.message;
    const trace = exception.getTrace;

    // Create a standardized error response in BaseResDto format
    const errorResponse = new BaseResDto();
    errorResponse.statusCode = status;
    errorResponse.message = message;
    errorResponse.data = null;

    // Use the provided trace or create a comprehensive one
    errorResponse.trace = trace || {
      timestamp: new Date().toISOString(),
      // path: request.url,
      // method: request.method,
      // statusCode: status,
      responseData: exception['response']?.data || null,
      context: exception['context'] || null
    };

    response.status(status).json(errorResponse);
  }
}
