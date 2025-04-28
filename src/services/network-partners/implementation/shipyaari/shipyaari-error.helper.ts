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
   * Format error message to avoid nested JSON stringification
   * @param message Original error message
   * @param responseData Optional response data
   * @returns Formatted error message
   */
  private formatErrorMessage(message: string, responseData?: any): string {
    // If message contains a JSON string (likely from nested stringification)
    if (message && message.includes('{"')) {
      try {
        // Extract actual error details from the Shipyaari response
        const match = message.match(/response: ({.*})/);
        if (match && match[1]) {
          const parsedJson = JSON.parse(match[1]);
          // Return a cleaner message using the parsed data
          return parsedJson.message || message.split("response:")[0].trim();
        }
      } catch (e) {
        // If parsing fails, continue with original message
      }
    }

    // If we have responseData with a message, use that directly
    if (responseData?.message) {
      return responseData.message;
    }

    return message;
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
      `Shipyaari ${operation} API error: ${errorMessage}`,
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

    // Check for custom AuthenticationError with response data
    if (error.name === "AuthenticationError" && error.responseData) {
      const errorMessage = error.responseData.message || error.message;

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
        error.responseData.statusCode || HttpStatus.UNAUTHORIZED,
        `Shipyaari ${operation} API error: ${errorMessage}`,
        errorData,
        traceData,
        this.partnerCode
      );
    }

    // Determine the appropriate status code
    const statusCode =
      error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;

    // Format error message to avoid nested JSON
    const errorMessage = this.formatErrorMessage(
      error.message,
      error.response?.data
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
      `Shipyaari ${operation} API error: ${errorMessage}`,
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
      `Shipyaari ${operation} validation error: ${message}`,
      errorData,
      traceData,
      this.partnerCode
    );
  }
}
