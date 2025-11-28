# Delhivery LTL Integration

This module provides integration with Delhivery LTL (Less Than Truckload) APIs for freight management.

## Overview

The Delhivery service provides APIs for:
- User authentication
- Pincode serviceability checking
- Manifest creation
- LRN (Load Receipt Number) updates
- LRN cancellation

## Configuration

Add the following environment variables to your `.env` file:

```bash
# Delhivery Base URL
DELHIVERY_BASE_URL=https://ltl-clients-api-dev.delhivery.com

# Delhivery Authentication (MANDATORY)
DELHIVERY_USERNAME=your_username
DELHIVERY_PASSWORD=your_password
DELHIVERY_LOGIN_URL=https://ltl-clients-api-dev.delhivery.com/ums/login
```

### Environment Variables

#### Required
- `DELHIVERY_USERNAME`: Your Delhivery username (MANDATORY)
- `DELHIVERY_PASSWORD`: Your Delhivery password (MANDATORY)

#### Optional (with defaults)
- `DELHIVERY_BASE_URL`: Base URL for Delhivery API (default: `https://ltl-clients-api-dev.delhivery.com`)
- `DELHIVERY_LOGIN_URL`: Login endpoint URL (default: `https://ltl-clients-api-dev.delhivery.com/ums/login`)

## API Endpoints

### 1. Login
**POST** `/delhivery/login`

Authenticate and get a Bearer token.

**Request Body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "token": "Bearer_Token_Here"
  }
}
```

### 2. Get Pincode Service
**GET** `/delhivery/pincode-service/:pincode?weight=1`

Check serviceability for a pincode.

**Parameters:**
- `pincode` (path): The pincode to check
- `weight` (query, optional): Weight in kg

**Response:**
```json
{
  "statusCode": 200,
  "message": "Pincode service retrieved successfully",
  "data": {
    // Delhivery pincode service data
  }
}
```

### 3. Create Manifest
**POST** `/delhivery/manifest`

Create a new shipment manifest.

**Request Body:**
```json
{
  "lrn": "",
  "pickup_location_name": "Your Warehouse Name",
  "payment_mode": "cod",
  "cod_amount": 122,
  "weight": 100,
  "dropoff_location": {
    "consignee_name": "Customer Name",
    "address": "Customer Address",
    "city": "City",
    "state": "State",
    "zip": "123456",
    "phone": "9876543210",
    "email": "customer@email.com"
  },
  "rov_insurance": true,
  "invoices": [
    {
      "ewaybill": "",
      "inv_num": "INV001",
      "inv_amt": 1000,
      "inv_qr_code": ""
    }
  ],
  "shipment_details": [
    {
      "order_id": "ORDER001",
      "box_count": 1,
      "description": "Product description",
      "weight": 100,
      "waybills": [],
      "master": false
    }
  ],
  "doc_data": [
    {
      "doc_type": "INVOICE_COPY",
      "doc_meta": {
        "invoice_num": ["INV001"]
      }
    }
  ],
  "fm_pickup": false,
  "freight_mode": "fop",
  "billing_address": {
    "name": "Billing Name",
    "company": "Company Name",
    "consignor": "Consignor Name",
    "address": "Billing Address",
    "city": "City",
    "state": "State",
    "pin": "123456",
    "phone": "9876543210",
    "pan_number": "ABCDE1234F",
    "gst_number": "29ABCDE1234F1Z5"
  }
}
```

**Response:**
```json
{
  "statusCode": 201,
  "message": "Manifest created successfully",
  "data": {
    // Delhivery manifest creation response
  }
}
```

### 4. Update LRN
**PUT** `/delhivery/lrn/update/:lrn`

Update an existing LRN.

**Parameters:**
- `lrn` (path): The LRN to update

**Request Body:**
```json
{
  "invoices": [
    {
      "inv_num": "INV001",
      "inv_amt": 1234
    }
  ],
  "cod_amount": 0,
  "consignee_name": "Updated Name",
  "consignee_address": "Updated Address",
  "consignee_pincode": "123456",
  "consignee_phone": "9999999999",
  "weight_g": 30,
  "dimensions": [
    {
      "width_cm": 5,
      "height_cm": 4,
      "length_cm": 3,
      "box_count": 1
    }
  ],
  "cb": {
    "uri": "https://your-callback-url.com/callback",
    "method": "POST",
    "authorization": "Bearer Token"
  }
}
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "LRN updated successfully",
  "data": {
    // Delhivery update response
  }
}
```

### 5. Cancel LRN
**DELETE** `/delhivery/lrn/cancel/:lrn`

Cancel an existing LRN.

**Parameters:**
- `lrn` (path): The LRN to cancel

**Response:**
```json
{
  "statusCode": 200,
  "message": "LRN cancelled successfully",
  "data": {
    // Delhivery cancellation response
  }
}
```

## Features

### Authentication
- Automatic token generation and caching
- Token expiry management (23-hour cache)
- Automatic token refresh when expired
- Bearer token authentication for all API calls

### Error Handling
The service handles various error scenarios:
- Missing credentials (401 UNAUTHORIZED)
- Authentication failures
- API request failures with detailed error messages

## Usage Example

```typescript
import { DelhiveryService } from './implementation/delhivery/delhivery.service';

// Inject the service
constructor(private readonly delhiveryService: DelhiveryService) {}

// Check pincode serviceability
async checkPincode() {
  try {
    const result = await this.delhiveryService.getPincodeService('122001', 1);
    console.log('Pincode data:', result.data);
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

// Create a manifest
async createManifest() {
  const manifestData = {
    pickup_location_name: 'My Warehouse',
    payment_mode: 'cod',
    cod_amount: 500,
    weight: 100,
    dropoff_location: {
      consignee_name: 'John Doe',
      address: 'Customer Address',
      city: 'Mumbai',
      state: 'Maharashtra',
      zip: '400001',
      phone: '9876543210'
    },
    // ... other required fields
  };
  
  const result = await this.delhiveryService.createDelhiveryManifest(manifestData);
  console.log('Manifest created:', result.data);
}

// Update LRN
async updateLrn() {
  const updateData = {
    lrn: '220110457',
    consignee_name: 'Updated Name',
    cod_amount: 600,
  };
  
  const result = await this.delhiveryService.updateDelhiveryLrn(updateData);
  console.log('LRN updated:', result.data);
}

// Cancel LRN
async cancelLrn() {
  const result = await this.delhiveryService.cancelDelhiveryLrn('220110457');
  console.log('LRN cancelled:', result.data);
}
```

## Module Registration

To use this service, import the `DelhiveryModule` in your feature module:

```typescript
import { DelhiveryModule } from './implementation/delhivery/delhivery.module';

@Module({
  imports: [DelhiveryModule],
  // ...
})
export class YourModule {}
```