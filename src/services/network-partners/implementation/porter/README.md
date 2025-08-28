# Porter Network Partner Implementation

## Overview
This module implements the Porter network partner integration for the distributor service, including order creation, cancellation, and updates.

## Features
- ✅ Create Order V2 (`createOrderV2`)
- ✅ Cancel Order V2 (`cancelOrderV2`) 
- ✅ Update Order V2 (`updateOrderV2`)

## Setup Requirements

### Environment Variables
The following environment variables must be configured:

```bash
# Porter API Configuration
# Note: API key is hardcoded in the auth service
PORTER_BASE_URL=https://pfe-apigw-uat.porter.in
PORTER_CREATE_ORDER_URL=https://pfe-apigw-uat.porter.in/v1/orders
```

### Database Configuration
The Porter cancel order functionality requires endpoint configurations to be stored in the database. You need to create an endpoint configuration record with the following details:

#### Endpoint Configuration for Cancel Order
```json
{
  "name": "Porter Cancel Order API",
  "method": "POST",
  "partnerCode": "PORTER",
  "url": "https://pfe-apigw-uat.porter.in/v1/orders/{order_id}/cancel",
  "endpointId": "CANCEL_ORDER",
  "contentType": "application/json",
  "requiresAuth": true,
  "urlParamMapping": [
    {
      "paramName": "order_id",
      "sourceField": "orderId"
    }
  ],
  "headerMapping": [
    {
      "headerName": "x-api-key",
      "sourceField": "apiKey"
    }
  ],
  "payloadMapperConfig": {
    "fields": [
      {
        "sources": "cancelReason",
        "destination": "cancel_reason"
      }
    ]
  },
  "responseMapping": {
    "successPath": "status",
    "statusCodePath": "status",
    "messagePath": "message",
    "dataPath": "data"
  },
  "timeout": 30000,
  "retryCount": 3,
  "retryDelay": 1000
}
```

## API Usage

### Cancel Order
```typescript
import { BaseCancelOrderDtoV2 } from 'src/common/dtos/base2.dto';

const cancelData: BaseCancelOrderDtoV2 = {
  cancelReason: "Customer requested cancellation",
  orderId: "CRN1756371254201",
  partnerCode: "PORTER"
};

const result = await porterService.cancelOrderV2(cancelData, "PORTER");
```

### Request Structure
The cancel order request expects:
- `cancelReason`: String describing why the order is being cancelled
- `cAwbNumbers`: Array of CRN numbers (Porter's order reference)
- `partnerCode`: Partner identifier (should be "PORTER")

### Response Structure
The response follows the standard `BaseResDto` format:
```typescript
{
  statusCode: 200,
  message: "Order cancelled successfully",
  data: { /* Porter API response */ },
  trace: {
    timestamp: "2024-01-01T00:00:00.000Z",
    partnerCode: "PORTER"
  }
}
```

## Implementation Details

### Schema Mapping
The service uses schema mapper configurations to transform data between the internal format and Porter's API format:

- **Request Mapping**: Transforms `cAwbNumbers[0]` to `order_id` path parameter
- **Response Mapping**: Maps Porter's response to standard response format

### Authentication
Authentication is handled by the `PorterAuthService` which provides:
- `x-api-key` header with the hardcoded API key: `659d4aaf-3797-4186-b7c3-2c231f5d0e22`
- `Content-Type: application/json` header

### Error Handling
The service includes comprehensive error handling:
- Input validation for required fields
- HTTP timeout configuration (30 seconds)
- Retry logic for transient failures
- Detailed error logging

## Testing
To test the cancel order functionality:

1. Ensure all environment variables are configured
2. Create the endpoint configuration in the database
3. Use the service with valid cancel order data
4. Verify the response format and status codes

## Troubleshooting

### Common Issues
1. **Endpoint configuration not found**: Ensure the database contains the correct endpoint configuration for `PORTER` + `CANCEL_ORDER`
2. **Authentication failed**: The API key is hardcoded. If authentication fails, verify the hardcoded key is still valid
3. **Invalid CRN number**: Ensure `cAwbNumbers` contains valid Porter order references (e.g., CRN1756371254201)

### Logs
The service logs all operations with detailed information:
- Request/response data
- Timing information
- Error details with context
