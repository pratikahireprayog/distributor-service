import { HttpStatus, Logger } from "@nestjs/common";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { BaseOrderResDto } from "src/common/dtos/base.dto";

/**
 * ShipyaariErrorHelper - Dedicated class for handling Shipyaari-specific errors
 * Following the Single Responsibility Principle, this class is only responsible for
 * error handling related to Shipyaari API calls.
 */
export class ShipyaariErrorHelper {
  private readonly logger = new Logger(ShipyaariErrorHelper.name);
  private partnerCode: PARTNER_CODE_ENUM;

  constructor(partnerCode: PARTNER_CODE_ENUM) {
    this.partnerCode = partnerCode;
  }

  /**
   * Handle API errors by throwing appropriate CustomHttpException
   * @param response API response with error
   * @param awbNumber Tracking number(s) - can be comma-separated string
   * @param operation API operation name
   */
  public handleApiError(
    response: any,
    awbNumber: string,
    operation: string
  ): never {
    // Extract status code from response or default to 422
    const statusCode = response?.statusCode || HttpStatus.UNPROCESSABLE_ENTITY;
    const errorMessage = response?.message || "API reported an error";

    this.logger.error(
      `[Shipyaari ${operation}] API Error for AWB: ${awbNumber} - Status: ${statusCode} - Message: ${errorMessage}`
    );

    // Convert comma-separated awbNumber string to array
    const awbNumbers = awbNumber ? awbNumber.split(",") : [];

    // Create error data structure
    const errorData = {
      success: false,
      awbNumbers: awbNumbers,
      message: errorMessage,
    };

    // Create trace information
    const traceData = {
      timestamp: new Date().toISOString(),
      operation: operation,
    };

    throw new CustomHttpException(
      statusCode,
      `Shipyaari ${operation} API error`,
      errorData,
      traceData,
      this.partnerCode
    );
  }

  /**
   * Handle HTTP errors from axios
   * @param error Error from axios
   * @param awbNumber Tracking number(s) - can be comma-separated string
   * @param operation API operation name
   */
  public handleHttpError(
    error: any,
    awbNumber: string,
    operation: string
  ): never {
    // Log the error first
    this.logger.error(
      `[Shipyaari ${operation}] HTTP Error for AWB: ${awbNumber || "Unknown"} - ${error.response?.status || 500} - ${JSON.stringify(error.response?.data || {})}`,
      error.stack
    );

    // If this is already a CustomHttpException, just rethrow it
    if (error instanceof CustomHttpException) {
      throw error;
    }

    // Convert comma-separated awbNumber string to array
    const awbNumbers = awbNumber ? awbNumber.split(",") : [];

    // Determine the appropriate status code
    const statusCode =
      error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const errorMessage =
      error.response?.data?.message || error.message || "HTTP request failed";

    // Create error data structure
    const errorData = {
      success: false,
      awbNumbers: awbNumbers,
      message: errorMessage,
    };

    // Create trace information
    const traceData = {
      timestamp: new Date().toISOString(),
      operation: operation,
    };

    throw new CustomHttpException(
      statusCode,
      `Shipyaari ${operation} API error`,
      errorData,
      traceData,
      this.partnerCode
    );
  }

  /**
   * Helper for validation errors
   * @param message Error message
   * @param awbNumber Tracking number(s) - can be comma-separated string
   * @param operation API operation name
   */
  public throwValidationError(
    message: string,
    awbNumber: string,
    operation: string
  ): never {
    // Convert comma-separated awbNumber string to array
    const awbNumbers = awbNumber ? awbNumber.split(",") : [];

    // Create error data structure
    const errorData = {
      success: false,
      awbNumbers: awbNumbers,
      message: message,
    };

    // Create trace information
    const traceData = {
      timestamp: new Date().toISOString(),
      operation: operation,
    };

    throw new CustomHttpException(
      HttpStatus.BAD_REQUEST,
      `Shipyaari ${operation} validation error`,
      errorData,
      traceData,
      this.partnerCode
    );
  }
}
