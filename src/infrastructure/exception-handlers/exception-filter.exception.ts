import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from "@nestjs/common";
import { Request, Response } from "express";
import * as path from "path";
import { CustomHttpException } from "./exception-handler.exception";
import { BaseResDto } from "src/common/dtos/base.dto";
import { ApplicationFailure } from "@temporalio/common";
import { TemporalErrorHandler } from "./temporal-error-handler";
import { AlertNotificationService } from "@innofulfill/core-node-library";

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal Server Error";
    let data = null;
    let trace = null;

    // Handle ApplicationFailure from Temporal
    if (exception instanceof ApplicationFailure) {
      const customData = TemporalErrorHandler.extractCustomErrorData(exception);
      if (customData && customData.errorType === "CustomHttpException") {
        status = customData.statusCode;
        message = customData.message;
        data = customData.data;
        trace = customData.trace;
      } else {
        message = exception.message;
        trace = {
          timestamp: new Date().toISOString(),
        };
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === "string"
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
        "GlobalExceptionFilter"
      );
      return response.status(status).json(exception);
    }

    // Create a standardized error response in BaseResDto format
    const errorResponse = new BaseResDto();
    errorResponse.statusCode = status;
    errorResponse.message = message;
    errorResponse.data = data;

    // Build a comprehensive trace with all available information
    errorResponse.trace = trace || {
      timestamp: new Date().toISOString(),
      // path: request.url,
      // method: request.method,
      // statusCode: status,
      // error: exception instanceof HttpException ? exception.name : 'Internal Server Error',
      // stack: exception instanceof Error ? exception.stack : '',
      // Include the original response data if available
      responseData:
        exception["response"]?.data || exception["response"] || null,
      // Include any additional context that might have been added
      context: exception["context"] || null,
    };

    // Log the detailed error
    this.logger.error(
      `Error occurred: ${message}`,
      JSON.stringify(errorResponse),
      "GlobalExceptionFilter"
    );

    // Send Discord alert for errors
    await this.sendDiscordAlert(
      exception,
      request,
      status,
      message,
      errorResponse
    );

    // Send response to client
    response.status(status).json(errorResponse);
  }

  private async sendDiscordAlert(
    exception: unknown,
    request: Request,
    status: number,
    message: string,
    errorResponse: any
  ): Promise<void> {
    try {
      this.logger.log(`🚨 Sending Discord alert from GlobalExceptionFilter...`);

      const alertService = new AlertNotificationService();

      // Extract additional context from the request
      const body = request.body || {};
      const awbNumber =
        body.order?.awbNumber ||
        body.awbNumber ||
        body.awbNumbers?.join(",") ||
        "unknown";
      const partnerCode = body.partnerCode || "unknown";

      // Determine operation type from the URL
      let operationType = "UnknownOperation";
      if (request.url.includes("create-order")) operationType = "CreateOrder";
      else if (request.url.includes("create-manifest"))
        operationType = "CreateManifest";
      else if (request.url.includes("get-order-details"))
        operationType = "GetOrderDetails";
      else if (request.url.includes("cancel-order"))
        operationType = "CancelOrder";
      else if (request.url.includes("push-order-to-drs"))
        operationType = "PushOrderToDRS";
      else if (request.url.includes("push-orders-to-prs"))
        operationType = "PushOrdersToPRS";
      else if (request.url.includes("push-order-to-tracking"))
        operationType = "PushOrderToTracking";
      else if (request.url.includes("manifest-order-to-tracking"))
        operationType = "ManifestOrderToTracking";
      else if (request.url.includes("update-ecom-order"))
        operationType = "UpdateEcomOrder";
      else if (request.url.includes("push-order-to-hubops"))
        operationType = "PushOrderToHubOps";

      const discordPayload = {
        channel: { discord: {} },
        traceId: "global-filter-" + Date.now(),
        metaData: {
          service: "Distributor-Service",
          version: "1.0.0",
          environment: process.env.NODE_ENV || "development",
        },
        error: {
          status: status,
          statusText: this.getStatusText(status),
          message: message,
          endpoint: request.url,
          method: request.method,
          timestamp: new Date().toISOString(),
          stack:
            exception instanceof Error
              ? exception.stack
              : "No stack trace available",
          requestId: awbNumber,
          additionalInfo: {
            operationType,
            awbNumber,
            partnerCode,
            caughtBy: "GlobalExceptionFilter",
            exceptionType: exception?.constructor?.name || "Unknown",
            requestBody: body,
            errorResponse: errorResponse,
          },
        },
      };

      this.logger.log(
        `📤 Sending Discord alert from GlobalExceptionFilter with payload: ${JSON.stringify(discordPayload, null, 2)}`
      );

      const result = await alertService.sendToDiscord(discordPayload);
      this.logger.log(
        `🔄 Discord API response from GlobalExceptionFilter: ${JSON.stringify(result)}`
      );

      this.logger.log(
        `✅ Discord alert sent successfully from GlobalExceptionFilter`
      );
    } catch (alertError) {
      this.logger.error(
        `❌ Failed to send Discord alert from GlobalExceptionFilter: ${alertError.message}`
      );
      this.logger.error(`Alert error stack: ${alertError.stack}`);
      this.logger.error(`Alert error details: ${JSON.stringify(alertError)}`);
    }
  }

  private getStatusText(status: number): string {
    switch (status) {
      case 400:
        return "Bad Request";
      case 401:
        return "Unauthorized";
      case 403:
        return "Forbidden";
      case 404:
        return "Not Found";
      case 500:
        return "Internal Server Error";
      case 502:
        return "Bad Gateway";
      case 503:
        return "Service Unavailable";
      default:
        return "Unknown Error";
    }
  }
}

@Catch(CustomHttpException)
export class CustomHttpExceptionFilter implements ExceptionFilter {
  catch(exception: CustomHttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const message = exception.message;
    const data = exception.getData;
    const trace = exception.getTrace;
    const partnerCode = exception.getPartnerCode;

    // Create a standardized error response
    const errorResponse = {
      statusCode: status,
      message: message,
      partnerCode: partnerCode,
      data: data,
      trace: trace || {
        timestamp: new Date().toISOString(),
      },
    };

    response.status(status).json(errorResponse);
  }
}
