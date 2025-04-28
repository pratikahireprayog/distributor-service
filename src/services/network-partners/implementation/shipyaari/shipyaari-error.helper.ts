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
   * @param awbNumbers Array of tracking numbers or comma-separated string
   * @param operation API operation name
   */
  public handleApiError(
    response: any,
    awbNumbers: string[] | string,
    operation: string
  ): never {
    // Extract status code from response or default to 422
    const statusCode = response?.statusCode || HttpStatus.UNPROCESSABLE_ENTITY;
    const errorMessage = response?.message || "API reported an error";

    // Convert input to array if it's a string
    const awbArray = Array.isArray(awbNumbers)
      ? awbNumbers
      : awbNumbers
        ? awbNumbers.split(",")
        : [];

    this.logger.error(
      `[Shipyaari ${operation}] API Error for AWBs: ${awbArray} - Status: ${statusCode} - Message: ${errorMessage}`
    );

    // Create error data structure
    const errorData = {
      success: false,
      awbNumbers: awbArray,
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
   * @param awbNumbers Array of tracking numbers or comma-separated string
   * @param operation API operation name
   */
  public handleHttpError(
    error: any,
    awbNumbers: string[] | string,
    operation: string
  ): never {
    // Convert input to array if it's a string
    const awbArray = Array.isArray(awbNumbers)
      ? awbNumbers
      : awbNumbers
        ? awbNumbers.split(",")
        : [];

    // Log the error first
    this.logger.error(
      `[Shipyaari ${operation}] HTTP Error for AWBs: ${awbArray.join(", ")} - ${error.response?.status || 500} - ${JSON.stringify(error.response?.data || {})}`,
      error.stack
    );

    // If this is already a CustomHttpException, just rethrow it
    if (error instanceof CustomHttpException) {
      throw error;
    }

    // Determine the appropriate status code
    const statusCode =
      error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const errorMessage =
      error.response?.data?.message || error.message || "HTTP request failed";

    // Create error data structure
    const errorData = {
      success: false,
      awbNumbers: awbArray,
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
   * @param awbNumbers Array of tracking numbers or comma-separated string
   * @param operation API operation name
   */
  public throwValidationError(
    message: string,
    awbNumbers: string[] | string,
    operation: string
  ): never {
    // Convert input to array if it's a string
    const awbArray = Array.isArray(awbNumbers)
      ? awbNumbers
      : awbNumbers
        ? awbNumbers.split(",")
        : [];

    // Create error data structure
    const errorData = {
      success: false,
      awbNumbers: awbArray,
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
