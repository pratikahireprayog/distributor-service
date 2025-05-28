import { Context } from "@temporalio/activity";
import {
  ActivityExecuteInput,
  ActivityInboundCallsInterceptor,
  Next,
} from "@temporalio/worker";
import {
  WorkflowExecuteInput,
  WorkflowInboundCallsInterceptor,
  ApplicationFailure,
  TemporalFailure,
  CancelledFailure,
  TerminatedFailure,
  TimeoutFailure,
  ContinueAsNew,
} from "@temporalio/workflow";
import {
  TemporalErrorHandler,
  isCustomHttpException,
} from "../../exception-handlers/temporal-error-handler";

/**
 * Activity Interceptor for handling CustomHttpException errors
 *
 * This interceptor automatically converts CustomHttpException to ApplicationFailure
 * with preserved details when thrown from activities.
 */
export class ActivityErrorInterceptor
  implements ActivityInboundCallsInterceptor
{
  constructor(private ctx: Context) {}

  async execute(
    input: ActivityExecuteInput,
    next: Next<ActivityInboundCallsInterceptor, "execute">
  ): Promise<unknown> {
    try {
      const result = await next(input);
      return result;
    } catch (error) {
      // Convert CustomHttpException to ApplicationFailure with preserved details
      if (isCustomHttpException(error)) {
        const applicationFailure =
          TemporalErrorHandler.convertToApplicationFailure(error);
        throw applicationFailure;
      }

      // For other errors, let them be handled by Temporal's default conversion
      throw error;
    }
  }
}

/**
 * Workflow Interceptor for handling CustomHttpException errors
 *
 * This interceptor handles error unwrapping and conversion to ensure
 * custom error details are preserved across workflow boundaries.
 */
export class WorkflowErrorInterceptor
  implements WorkflowInboundCallsInterceptor
{
  async execute(
    input: WorkflowExecuteInput,
    next: Next<WorkflowInboundCallsInterceptor, "execute">
  ): Promise<unknown> {
    try {
      return await next(input);
    } catch (error) {
      // Pass along native Temporal errors without modification
      if (
        this.isTemporalNativeError(error) ||
        (error instanceof TemporalFailure &&
          this.isTemporalNativeError(error.cause))
      ) {
        throw error;
      }

      // When CustomHttpException is thrown directly in this workflow
      if (isCustomHttpException(error)) {
        const applicationFailure =
          TemporalErrorHandler.convertToApplicationFailure(error);
        throw applicationFailure;
      }

      // When ApplicationFailure with custom details is thrown from an activity
      // Preserve it without additional wrapping
      if (
        error instanceof ApplicationFailure &&
        TemporalErrorHandler.isApplicationFailureWithCustomDetails(error)
      ) {
        throw error;
      }

      // When CustomHttpException is thrown in a child workflow
      // Unwrap and convert to ApplicationFailure
      if (
        error instanceof TemporalFailure &&
        isCustomHttpException(error.cause)
      ) {
        const applicationFailure =
          TemporalErrorHandler.convertToApplicationFailure(error.cause);
        throw applicationFailure;
      }

      // When ApplicationFailure with custom details is thrown in an activity inside a child workflow
      // Unwrap the ApplicationFailure to avoid double wrapping
      if (
        error instanceof TemporalFailure &&
        error.cause instanceof ApplicationFailure &&
        TemporalErrorHandler.isApplicationFailureWithCustomDetails(error.cause)
      ) {
        throw error.cause;
      }

      // For other errors, convert them to ApplicationFailure with basic details
      const applicationFailure =
        TemporalErrorHandler.convertToApplicationFailure(error);
      throw applicationFailure;
    }
  }

  /**
   * Check if error is a native Temporal error that should not be modified
   */
  private isTemporalNativeError(error: unknown): boolean {
    return (
      error instanceof ContinueAsNew ||
      error instanceof CancelledFailure ||
      error instanceof TerminatedFailure ||
      error instanceof TimeoutFailure
    );
  }
}

/**
 * Utility function to extract custom error data from any error in a workflow context
 *
 * @param error - Error to extract data from
 * @returns Custom error data or null
 */
export function extractCustomErrorDataFromWorkflowError(
  error: unknown
): any | null {
  // Direct ApplicationFailure with custom details
  if (error instanceof ApplicationFailure) {
    return TemporalErrorHandler.extractCustomErrorData(error);
  }

  // ApplicationFailure wrapped in TemporalFailure (from activities/child workflows)
  if (
    error instanceof TemporalFailure &&
    error.cause instanceof ApplicationFailure
  ) {
    return TemporalErrorHandler.extractCustomErrorData(error.cause);
  }

  // Direct CustomHttpException
  if (isCustomHttpException(error)) {
    return {
      statusCode: error.getStatus(),
      errorData: error.getData,
      traceData: error.getTrace,
      partnerCode: error.getPartnerCode,
    };
  }

  return null;
}

/**
 * Utility function to recreate CustomHttpException from workflow error
 *
 * @param error - Error to recreate from
 * @returns CustomHttpException or original error
 */
export function recreateCustomHttpExceptionFromWorkflowError(
  error: unknown
): any {
  const customData = extractCustomErrorDataFromWorkflowError(error);

  if (customData && customData.errorType === "CustomHttpException") {
    return TemporalErrorHandler.recreateCustomHttpException(
      error as ApplicationFailure
    );
  }

  return error;
}
