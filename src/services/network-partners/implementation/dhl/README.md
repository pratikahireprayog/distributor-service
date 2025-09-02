# DHL Express Network Partner Implementation

## Overview

This module implements DHL Express as a network partner for the distributor service, providing order creation, cancellation, and pickup management capabilities using **environment variables** for configuration instead of MongoDB.

## Features

- ✅ **Order Management**: Create, cancel, and update orders
- ✅ **Pickup Management**: Create and cancel pickup requests
- ✅ **Authentication**: Basic authentication with DHL API
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **Response Standardization**: Consistent response format across all operations
- ✅ **Environment-Based Configuration**: No MongoDB dependency for endpoint configurations

## Environment Variables

```bash
# DHL Express API Configuration
DHL_EXPRESS_API_URL=https://express.api.dhl.com/mydhlapi
DHL_AUTH_TOKEN=your_dhl_auth_token_here

# Optional: Override default values
DHL_BASE_URL=https://express.api.dhl.com/mydhlapi
```

## API Endpoints

### 1. Create Pickup V2

**Endpoint**: `POST /distributor/create-pickup-v2?partnerCode=DHL`

**Request Body**:
```json
{
  "plannedPickupDateAndTime": "2025-08-29T10:00:00 GMT+05:30",
  "accounts": [
    {
      "typeCode": "shipper",
      "number": "535911093"
    }
  ],
  "customerDetails": {
    "shipperDetails": {
      "postalAddress": {
        "postalCode": "560086",
        "cityName": "Bangalore",
        "countryCode": "IN",
        "addressLine1": "MG Road, Near Church Street"
      },
      "contactInformation": {
        "email": "pickup@example.com",
        "phone": "9876543210",
        "mobilePhone": "9876543210",
        "companyName": "Pickup Company Pvt Ltd",
        "fullName": "Pickup Manager"
      }
    }
  },
  "shipmentDetails": [
    {
      "productCode": "P",
      "localProductCode": "P",
      "unitOfMeasurement": "metric"
    }
  ]
}
```

**Response**:
```json
{
  "statusCode": 200,
  "message": "Pickup created successfully with DHL",
  "data": {
    "dispatchConfirmationNumbers": ["CBJ250829000090"]
  },
  "trace": {
    "timestamp": "2025-08-28T09:20:28.690Z",
    "partnerCode": "DHL"
  }
}
```

### 2. Cancel Pickup V2

**Endpoint**: `POST /distributor/cancel-pickup-v2?partnerCode=DHL`

**Request Body**:
```json
{
  "pickupId": "CBJ250829000090",
  "requestorName": "Pickup Manager",
  "reason": "Cancelled by customer"
}
```

**Response**:
```json
{
  "statusCode": 200,
  "message": "Pickup cancelled successfully with DHL",
  "data": {
    "message": "Successfully cancelled"
  },
  "trace": {
    "timestamp": "2025-08-28T09:20:28.690Z",
    "partnerCode": "DHL"
  }
}
```

## Testing with cURL

### Create Pickup
```bash
curl --location 'http://localhost:3000/distributor/create-pickup-v2?partnerCode=DHL' \
--header 'Content-Type: application/json' \
--data-raw '{
  "plannedPickupDateAndTime": "2025-08-29T10:00:00 GMT+05:30",
  "accounts": [
    {
      "typeCode": "shipper",
      "number": "535911093"
    }
  ],
  "customerDetails": {
    "shipperDetails": {
      "postalAddress": {
        "postalCode": "560086",
        "cityName": "Bangalore",
        "countryCode": "IN",
        "addressLine1": "MG Road, Near Church Street"
      },
      "contactInformation": {
        "email": "pickup@example.com",
        "phone": "9876543210",
        "mobilePhone": "9876543210",
        "companyName": "Pickup Company Pvt Ltd",
        "fullName": "Pickup Manager"
      }
    }
  },
  "shipmentDetails": [
    {
      "productCode": "P",
      "localProductCode": "P",
      "unitOfMeasurement": "metric"
    }
  ]
}'
```

### Cancel Pickup
```bash
curl --location 'http://localhost:3000/distributor/cancel-pickup-v2?partnerCode=DHL' \
--header 'Content-Type: application/json' \
--data-raw '{
  "pickupId": "CBJ250829000090",
  "requestorName": "Pickup Manager",
  "reason": "Cancelled by customer"
}'
```

## Implementation Details

### Factory Pattern

The pickup functionality follows the established factory pattern:

1. **Interface**: `INetworkPartner` defines `createPickupV2` and `cancelPickupV2` methods
2. **Base Class**: `BaseNetworkPartner` provides abstract implementations
3. **DHL Implementation**: `DHLService` implements DHL-specific logic using environment variables
4. **Factory**: `NetworkPartnerFactoryService` creates appropriate partner instances
5. **Distributor Service**: Acts as a facade, routing requests to network partners

### DTOs

- **`DHLCreatePickupDto`**: Validates pickup creation requests
- **`DHLCancelPickupDto`**: Validates pickup cancellation requests
- **`DHLPickupResponseDto`**: Standardizes pickup responses

### Environment Variable Configuration

The DHL service uses environment variables directly instead of MongoDB:

```typescript
// Build the URL from environment variable
const baseUrl = this.configService.get<string>('DHL_EXPRESS_API_URL') || 'https://express.api.dhl.com/mydhlapi/test';
const pickupUrl = `${baseUrl}/pickups`;

// Get auth headers from auth service
const authHeaders = await this.authProvider.getAuthHeaders();
```

### Error Handling

- **Input Validation**: Comprehensive validation of request data
- **HTTP Errors**: Proper handling of DHL API errors
- **Logging**: Detailed logging for debugging and monitoring
- **Discord Alerts**: Error notifications via Discord webhook

## Configuration

### Environment Variables

Set these environment variables in your `.env` file:

```bash
# DHL Express API Configuration
DHL_EXPRESS_API_URL=https://express.api.dhl.com/mydhlapi
DHL_AUTH_TOKEN=your_dhl_auth_token_here

# Optional: Override default values
DHL_BASE_URL=https://express.api.dhl.com/mydhlapi
```

### URL Construction

The service automatically constructs URLs based on environment variables:

- **Create Pickup**: `${DHL_EXPRESS_API_URL}/pickups`
- **Cancel Pickup**: `${DHL_EXPRESS_API_URL}/pickups/{pickupId}?requestorName={requestorName}&reason={reason}`

### Headers

The service automatically generates required headers:

- **Message-Reference**: Unique timestamp-based reference
- **Message-Reference-Date**: Current UTC timestamp
- **Plugin-Name/Version**: Empty values as required by DHL
- **Shipping-System-Platform-Name/Version**: Empty values as required by DHL
- **Webstore-Platform-Name/Version**: Empty values as required by DHL
- **x-version**: Fixed value "2.12.0"

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Verify `DHL_AUTH_TOKEN` environment variable
2. **URL Errors**: Check `DHL_EXPRESS_API_URL` configuration
3. **Validation Errors**: Ensure all required fields are provided
4. **Timeout Errors**: Default timeout is 30 seconds

### Debug Mode

Enable debug logging to see detailed request/response information:

```typescript
// In your environment configuration
LOG_LEVEL=debug
```

### Environment Variable Validation

The service validates environment variables on startup:

```typescript
if (!baseUrl) {
  throw new CustomHttpException(
    HttpStatus.BAD_REQUEST,
    'DHL_EXPRESS_API_URL environment variable is not configured'
  );
}
```

## Advantages of Environment Variable Approach

1. **✅ No MongoDB Dependency**: Faster startup, no database connection issues
2. **✅ Easy Configuration**: Simple environment variable changes
3. **✅ Deployment Friendly**: Works in containerized environments
4. **✅ Version Control**: Configuration can be managed in deployment scripts
5. **✅ Performance**: No database queries for endpoint configurations

## Future Enhancements

- [ ] **Pickup Scheduling**: Support for recurring pickups
- [ ] **Status Tracking**: Real-time pickup status updates
- [ ] **Bulk Operations**: Handle multiple pickup requests
- [ ] **Webhook Support**: Receive pickup status notifications
- [ ] **Rate Limiting**: Implement API rate limiting
- [ ] **Retry Logic**: Enhanced retry mechanisms for failed requests

## Support

For issues or questions:

1. Check the logs for detailed error information
2. Verify environment variable configuration
3. Test with cURL commands to isolate issues
4. Review DHL API documentation for endpoint changes
5. Ensure all required environment variables are set
