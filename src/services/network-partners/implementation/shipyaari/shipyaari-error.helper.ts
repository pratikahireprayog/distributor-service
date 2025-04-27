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

  constructor(private readonly partnerCode: PARTNER_CODE_ENUM) {}

  /**
   * Handle API errors by throwing appropriate CustomHttpException
   * @param response API response with error
   * @param awbNumber Tracking number
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

    const errorResponse = {
      success: false,
      awbNumber: awbNumber,
      message: errorMessage,
      errorDetails: response,
    };

    throw new CustomHttpException(
      statusCode,
      `Shipyaari ${operation} API error`,
      errorResponse
    );
  }

  /**
   * Handle HTTP errors from axios
   * @param error Error from axios
   * @param awbNumber Tracking number
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

    // Common standardized response format
    const createErrorResponse = (
      statusCode: number,
      message: string,
      details: any = {}
    ) => {
      return {
        success: false,
        awbNumber: awbNumber,
        message: message,
        errorDetails: details,
      };
    };

    // If we have response data with a status code
    if (error.response?.data?.statusCode) {
      const errorMessage = error.response.data.message || "API error";
      throw new CustomHttpException(
        error.response.data.statusCode,
        `Shipyaari ${operation} API error`,
        createErrorResponse(
          error.response.data.statusCode,
          errorMessage,
          error.response.data
        )
      );
    }

    // For other Axios errors with response
    if (error.response) {
      const errorMessage =
        error.response.data?.message || error.message || "HTTP request failed";
      throw new CustomHttpException(
        error.response.status,
        `Shipyaari ${operation} API error`,
        createErrorResponse(
          error.response.status,
          errorMessage,
          error.response.data
        )
      );
    }

    // Generic error (network error, timeout, etc.)
    const errorMessage = error.message || "Unknown error occurred";
    throw new CustomHttpException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      `Shipyaari ${operation} API error`,
      createErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, errorMessage)
    );
  }

  /**
   * Helper for validation errors
   * @param message Error message
   * @param awbNumber Tracking number
   * @param operation API operation name
   */
  public throwValidationError(
    message: string,
    awbNumber: string,
    operation: string
  ): never {
    throw new CustomHttpException(
      HttpStatus.BAD_REQUEST,
      `Shipyaari ${operation} validation error`,
      {
        success: false,
        awbNumber,
        message,
        partnerCode: this.partnerCode,
        operation,
      }
    );
  }
}
