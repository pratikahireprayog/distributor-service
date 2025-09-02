# UNIUNI Network Partner Integration

## Overview
UNIUNI is a network partner service that handles order creation through their API. This service implements the `createOrderV2` functionality with automatic authentication and payload transformation.

## Environment Variables
Add these to your `.env` file:

```env
# UNIUNI Configuration
UNIUNI_CLIENT_ID=100552
UNIUNI_CLIENT_SECRET=acad964f336dff02415362087539c9f2
UNIUNI_AUTH_URL=https://sjqa.uniexpress.org/storeauth/customertoken
```

## API Endpoints

### Authentication
- **URL**: `https://sjqa.uniexpress.org/storeauth/customertoken`
- **Method**: POST
- **Payload**: OAuth 2.0 Client Credentials flow
- **Response**: JWT token with expiry

### Create Order
- **URL**: `https://sjqa.uniexpress.org/orders/createbusinessorder`
- **Method**: POST
- **Authentication**: Bearer token
- **Payload**: Transformed order data

## Payload Transformation

### Input Payload (createOrderV2)
```json
{
  "partnerCode": "UNIUNI",
  "order": {
    "orderId": "1256",
    "referenceId": "CFYGUYIHO",
    "addresses": [
      {
        "type": "PICKUP",
        "zip": "411028",
        "name": "Rohan Sharma",
        "phone": "6313131313",
        "email": "rohan@yopmail.com",
        "street": "32, pocket D, sector 8, Near City Center",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India"
      },
      {
        "type": "DELIVERY",
        "zip": "10001",
        "name": "Jane Smith",
        "phone": "2125557890",
        "email": "jane@example.com",
        "street": "123 Madison Avenue",
        "city": "New York",
        "state": "NY",
        "country": "United States"
      }
    ],
    "parentShipment": {
      "dimensions": {
        "length": 30,
        "width": 20,
        "height": 10
      },
      "physicalWeight": 300
    }
  }
}
```

### Transformed Payload (UNIUNI API)
```json
{
  "customer_no": 2821,
  "reference": "CFYGUYIHO",
  "trace_no": "1256",
  "pickup_address": "32, pocket D, sector 8, Near City Center, Mumbai",
  "delivery_address": "123 Madison Avenue, New York, NY, United States",
  "postal_code": "10001",
  "receiver": "Jane Smith",
  "delivery_unit_no": "",
  "receiver_phone": "2125557890",
  "receiver_email": "jane@example.com",
  "length": 30,
  "width": 20,
  "height": 10,
  "weight": 300,
  "weight_uom": "LBS",
  "dimension_uom": "IN",
  "buzz_code": "CFYGUYIHO",
  "require_signature": false,
  "start_postal_code": "411028",
  "pickup_warehouse": ""
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "orderId": "UNIUNI_ORDER_123",
    "trackingNumber": "TRK123456789",
    "status": "CREATED",
    "partnerCode": "UNIUNI"
  },
  "statusCode": 200
}
```

### Error Response
```json
{
  "success": false,
  "message": "UNIUNI order creation failed: Invalid payload",
  "data": null,
  "statusCode": 400
}
```

## Authentication Flow

1. **Token Request**: Service automatically requests OAuth 2.0 token
2. **Token Caching**: Token is cached until expiry (with 5-minute buffer)
3. **Concurrent Protection**: Prevents multiple simultaneous token requests
4. **Automatic Refresh**: Token is refreshed automatically when needed

## Error Handling

- **Authentication Errors**: Retries with new token
- **API Errors**: Returns structured error responses
- **Payload Errors**: Validates required fields before transformation
- **Network Errors**: Logs detailed error information

## Testing

### cURL Command
```bash
curl -X POST http://localhost:3039/distributor/create-order-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "partnerCode": "UNIUNI",
    "order": {
      "orderId": "1256",
      "referenceId": "CFYGUYIHO",
      "addresses": [
        {
          "type": "PICKUP",
          "zip": "411028",
          "name": "Rohan Sharma",
          "phone": "6313131313",
          "email": "rohan@yopmail.com",
          "street": "32, pocket D, sector 8, Near City Center",
          "city": "Mumbai",
          "state": "Maharashtra",
          "country": "India"
        },
        {
          "type": "DELIVERY",
          "zip": "10001",
          "name": "Jane Smith",
          "phone": "2125557890",
          "email": "jane@example.com",
          "street": "123 Madison Avenue",
          "city": "New York",
          "state": "NY",
          "country": "United States"
        }
      ],
      "parentShipment": {
        "dimensions": {
          "length": 30,
          "width": 20,
          "height": 10
        },
        "physicalWeight": 300
      }
    }
  }'
```

## Features

- ✅ **createOrderV2** - Full order creation with payload transformation
- ✅ **Automatic Authentication** - OAuth 2.0 token management
- ✅ **Payload Transformation** - Maps internal DTOs to UNIUNI API format
- ✅ **Error Handling** - Comprehensive error handling and logging
- ✅ **Token Caching** - Efficient token management with expiry
- ✅ **Response Formatting** - Standardized response format

## Dependencies

- `@nestjs/common` - NestJS framework
- `@nestjs/axios` - HTTP client for API calls
- `@nestjs/config` - Configuration management
- `rxjs` - Reactive programming utilities

