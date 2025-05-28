import { ApplicationFailure } from "@temporalio/common";
import { CustomHttpException } from "./exception-handler.exception";

/**
 * Temporal Error Handler for preserving custom error details across service boundaries
 *
 * This handler converts CustomHttpException to Temporal's ApplicationFailure
 * with all custom data preserved in the details field, ensuring error information
 * is not lost during Temporal's serialization process.
 */
export class TemporalErrorHandler {
  /**
   * Convert CustomHttpException to ApplicationFailure with preserved details
   *
   * @param error - The error to convert
   * @returns ApplicationFailure with custom data in details field
   */
  static convertToApplicationFailure(error: any): ApplicationFailure {
    if (error instanceof CustomHttpException) {
      // Structure the error details to match expected HTTP response format
      const errorDetails = {
        statusCode: error.getStatus(),
        message: error.message,
        data: error.getData, // This contains originalResponse, requestUrl, requestBody
        trace: error.getTrace || {
          timestamp: new Date().toISOString(),
        },
        partnerCode: error.getPartnerCode,
        errorType: "CustomHttpException",
      };

      // Create ApplicationFailure with custom data in details field - RETRYABLE
      return ApplicationFailure.retryable(
        error.message,
        "CustomHttpException",
        errorDetails
      );
    }

    // For other error types, create a generic ApplicationFailure - RETRYABLE
    if (error instanceof Error) {
      const errorDetails = {
        statusCode: 500,
        message: error.message,
        data: null,
        trace: {
          timestamp: new Date().toISOString(),
        },
        errorName: error.name,
        stack: error.stack,
        errorType: "GenericError",
      };

      return ApplicationFailure.retryable(
        error.message,
        error.name || "UnknownError",
        errorDetails
      );
    }

    // For non-Error objects - RETRYABLE
    const errorDetails = {
      statusCode: 500,
      message: "Unknown error occurred",
      data: {
        originalError: error,
      },
      trace: {
        timestamp: new Date().toISOString(),
      },
      errorType: "UnknownError",
    };

    return ApplicationFailure.retryable(
      "Unknown error occurred",
      "UnknownError",
      errorDetails
    );
  }

  /**
   * Extract custom error data from ApplicationFailure
   *
   * @param error - ApplicationFailure to extract data from
   * @returns Custom error data or null if not found
   */
  static extractCustomErrorData(error: ApplicationFailure): any | null {
    if (!error.details || error.details.length === 0) {
      return null;
    }

    // Return the first detail object which contains our custom data
    return error.details[0];
  }

  /**
   * Recreate CustomHttpException from ApplicationFailure details
   *
   * @param error - ApplicationFailure with custom details
   * @returns Reconstructed CustomHttpException or original error
   */
  static recreateCustomHttpException(
    error: ApplicationFailure
  ): CustomHttpException | ApplicationFailure {
    const customData = this.extractCustomErrorData(error);

    if (customData && customData.errorType === "CustomHttpException") {
      return new CustomHttpException(
        customData.statusCode,
        customData.message,
        customData.data,
        customData.trace,
        customData.partnerCode
      );
    }

    // Return original error if it's not a CustomHttpException
    return error;
  }

  /**
   * Check if an error is a Temporal ApplicationFailure with custom details
   *
   * @param error - Error to check
   * @returns True if it's an ApplicationFailure with custom details
   */
  static isApplicationFailureWithCustomDetails(
    error: any
  ): error is ApplicationFailure {
    return (
      error instanceof ApplicationFailure &&
      error.details &&
      error.details.length > 0 &&
      (error.details[0] as any)?.errorType
    );
  }

  /**
   * Utility to safely throw ApplicationFailure in Temporal context
   *
   * @param error - Original error to convert and throw
   * @throws ApplicationFailure with preserved custom data
   */
  static throwAsApplicationFailure(error: any): never {
    const applicationFailure = this.convertToApplicationFailure(error);
    throw applicationFailure;
  }
}

/**
 * Type guard to check if error is CustomHttpException
 */
export function isCustomHttpException(
  error: any
): error is CustomHttpException {
  return error instanceof CustomHttpException;
}

/**
 * Type guard to check if error is ApplicationFailure
 */
export function isApplicationFailure(error: any): error is ApplicationFailure {
  return error instanceof ApplicationFailure;
}

/**
 * Extract error details safely from any error type
 */
export function extractErrorDetails(error: any): any {
  if (isApplicationFailure(error)) {
    return TemporalErrorHandler.extractCustomErrorData(error);
  }

  if (isCustomHttpException(error)) {
    return {
      statusCode: error.getStatus(),
      message: error.message,
      data: error.getData,
      trace: error.getTrace,
      partnerCode: error.getPartnerCode,
    };
  }

  return null;
}
