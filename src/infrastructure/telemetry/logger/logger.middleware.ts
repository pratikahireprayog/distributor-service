import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class NestLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, path: url, body, query, params } = request;
    const userAgent = request.get('user-agent') || '';

    try {
      if (method !== 'GET' && !url.includes('ping')) {
        // Log the request data
        this.logger.log(
          `Request: ${JSON.stringify({ ip, method, url, body, query, params, userAgent }, null, 2)}`,
        );

        // Hook into the 'finish' event to log the response body
        response.on('finish', () => {
          const { statusCode } = response;
          const contentLength = response.get('content-length');

          // Ensure the response body is an object before stringifying
          const responseBody =
            typeof response.locals.body === 'string'
              ? JSON.parse(response.locals.body)
              : response.locals.body;

          // Log the response body
          this.logger.log(
            `Response: ${JSON.stringify({ statusCode, contentLength, body: responseBody }, null, 2)}`,
          );
        });

        // Capture the response body
        const send = response.send;
        response.send = function (body): Response {
          response.locals.body = body;
          return send.call(this, body);
        };
      }
    } catch (error) {
      this.logger.error(`Failed to log request/response: ${error.message}`);
    }

    next();
  }
}
