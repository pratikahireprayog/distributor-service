import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trace, context } from '@opentelemetry/api';
// import { AutoInstrumentation } from './otel-auto-instrumentation';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) {
      currentSpan.setAttributes({
        // 'http.request.method': req.method,
        'http.request.url': req.url,
        'http.request.headers': JSON.stringify(req?.headers),
        'http.request.body': JSON.stringify(req?.body),
      });

      res.on('finish', () => {
        currentSpan.setAttributes({
          'http.response.status_code': res?.statusCode,
          'http.response.headers': JSON.stringify(res?.getHeaders()),
          'http.response.body': res?.locals?.body,
        });
      });
    }
    next();
  }
}

// @Injectable()
// export class MetricsRequestCountMiddleware implements NestMiddleware {
//   constructor(private readonly autoInstrumentation: AutoInstrumentation) {}

//   use(req: Request, res: Response, next: NextFunction) {
//     this.autoInstrumentation.incrementRequestCount(req.route.path);
//     next();
//   }
// }
