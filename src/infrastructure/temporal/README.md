# Temporal Error Handling Solution

This document explains how to properly handle custom exceptions with detailed payloads in Temporal workflows, ensuring error information is preserved across service boundaries.

## Problem

When `CustomHttpException` is thrown in the distributor service and sent to the workflow orchestrator service via Temporal, the custom error details (originalResponse, requestDetails, etc.) are lost during Temporal's serialization process. Only basic error properties (message, source, stackTrace) are preserved.

## Solution

We use Temporal's `ApplicationFailure` with the `details` field to preserve custom error data across service boundaries.

### Key Components

1. **TemporalErrorHandler** - Converts CustomHttpException to ApplicationFailure with preserved details
2. **Error Interceptors** - Automatically handle error conversion in activities and workflows
3. **Utility Functions** - Extract and recreate custom errors from ApplicationFailure

## Usage

### 1. Automatic Error Conversion

The solution automatically converts `CustomHttpException` to `ApplicationFailure` when thrown:

```typescript
// In your service method
throw new CustomHttpException(HttpStatus.BAD_REQUEST, "API call failed", {
  originalResponse: errorData,
  requestUrl: url,
  requestBody: body,
});

// Automatically converted to ApplicationFailure with details preserved
```

### 2. Manual Error Conversion

You can also manually convert errors:

```typescript
import { TemporalErrorHandler } from "src/infrastructure/exception-handlers";

try {
  // Some operation that might fail
} catch (error) {
  // Convert and throw as ApplicationFailure
  TemporalErrorHandler.throwAsApplicationFailure(error);
}
```

### 3. Extracting Error Details in Workflows

In your workflow, you can extract the original error details:

```typescript
import { extractCustomErrorDataFromWorkflowError } from "src/infrastructure/temporal/interceptors/error-interceptor";

try {
  await someActivity();
} catch (error) {
  // Extract custom error details
  const customData = extractCustomErrorDataFromWorkflowError(error);

  if (customData) {
    console.log("Original error data:", customData.errorData);
    console.log("Request URL:", customData.requestUrl);
    console.log("Status Code:", customData.statusCode);
  }

  throw error; // Re-throw to fail the workflow
}
```

### 4. Recreating CustomHttpException

You can recreate the original `CustomHttpException` from the workflow error:

```typescript
import { recreateCustomHttpExceptionFromWorkflowError } from "src/infrastructure/temporal/interceptors/error-interceptor";

try {
  await someActivity();
} catch (error) {
  // Recreate the original CustomHttpException
  const originalError = recreateCustomHttpExceptionFromWorkflowError(error);

  if (originalError instanceof CustomHttpException) {
    // Now you have access to all original methods and properties
    console.log("Status:", originalError.getStatus());
    console.log("Data:", originalError.getData);
    console.log("Partner Code:", originalError.getPartnerCode);
  }
}
```

## Error Data Structure

The `ApplicationFailure.details` field contains:

```typescript
{
  statusCode: number; // HTTP status code
  originalMessage: string; // Original error message
  errorData: any; // Custom error data
  traceData: any; // Trace information
  partnerCode: string; // Partner code
  timestamp: string; // ISO timestamp
  errorType: "CustomHttpException"; // Error type identifier
}
```

## Interceptor Configuration

The error interceptors are automatically applied to handle error conversion:

- **ActivityErrorInterceptor** - Handles errors in activities
- **WorkflowErrorInterceptor** - Handles errors in workflows and unwraps nested errors

## Benefits

1. **Preserves All Error Details** - No loss of custom error information
2. **Automatic Conversion** - No need to manually handle error conversion in most cases
3. **Temporal Compatible** - Uses Temporal's recommended `ApplicationFailure` approach
4. **Type Safe** - Maintains TypeScript type safety
5. **Backward Compatible** - Works with existing error handling patterns

## Best Practices

1. **Use TemporalErrorHandler.throwAsApplicationFailure()** for manual error conversion
2. **Extract error details in workflows** using the provided utility functions
3. **Log error details** for debugging and monitoring
4. **Handle both ApplicationFailure and CustomHttpException** in error handling code
5. **Test error scenarios** to ensure details are preserved correctly

## Example: Complete Error Handling Flow

```typescript
// 1. Service throws CustomHttpException
async function callExternalAPI() {
  try {
    const response = await httpClient.post(url, data);
    return response.data;
  } catch (error) {
    // This gets automatically converted to ApplicationFailure
    throw new CustomHttpException(
      HttpStatus.BAD_REQUEST,
      "External API failed",
      {
        originalResponse: error.response?.data,
        requestUrl: url,
        requestBody: data,
      }
    );
  }
}

// 2. Workflow handles the error
async function myWorkflow() {
  try {
    await callExternalAPI();
  } catch (error) {
    // Extract custom error details
    const errorDetails = extractCustomErrorDataFromWorkflowError(error);

    if (errorDetails) {
      // Log detailed error information
      console.log("API call failed:", {
        statusCode: errorDetails.statusCode,
        requestUrl: errorDetails.requestUrl,
        originalResponse: errorDetails.errorData?.originalResponse,
      });

      // Decide whether to retry or fail based on error details
      if (errorDetails.statusCode >= 500) {
        // Server error - might be retryable
        throw error;
      } else {
        // Client error - probably not retryable
        throw ApplicationFailure.nonRetryable(
          "Non-retryable API error",
          "ClientError",
          errorDetails
        );
      }
    }

    throw error;
  }
}
```

This solution ensures that all custom error information is preserved when errors cross Temporal service boundaries, enabling better error handling, debugging, and monitoring in distributed workflows.
