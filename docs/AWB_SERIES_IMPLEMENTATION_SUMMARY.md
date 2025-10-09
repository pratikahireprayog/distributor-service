# AWB Series Assignment Implementation Summary

## Overview

Successfully implemented AWB series assignment for SMILE_HUBOPS partner with automatic number allocation, consumption tracking, Discord notifications, and admin API for series management.

## Implementation Details

### 1. DTO Updates ✅

- **File**: `src/common/dtos/base2.dto.ts`
- Added `assignAWBFromSeries?: boolean` field to `BaseOrderReqDtoV2` class
- When set to `true`, AWB numbers will be automatically assigned from the configured series

### 2. Database Schema & Repositories ✅

#### AWB Series Collection

- **Location**: `src/common/repositories/awb-series/`
- **Schema Fields**:
  - `partnerCode`: Unique identifier for partner
  - `seriesStart`: Starting AWB number (e.g., 25800035001)
  - `seriesEnd`: Ending AWB number (e.g., 25800535000)
  - `currentCounter`: Current AWB number (atomically incremented)
  - `isActive`: Whether series is active
  - `notificationThresholds`: Array tracking sent notification thresholds
  - `createdAt`, `updatedAt`: Timestamps

#### AWB Series Audit Collection

- **Location**: `src/common/repositories/awb-series-audit/`
- **Schema Fields**:
  - `seriesId`: Reference to parent series
  - `partnerCode`: Partner identifier
  - `awbNumber`: Original AWB from order
  - `orderId`: Order that consumed this number
  - `consumedAt`: Timestamp of consumption
  - `awbType`: "parent" or "child"
  - `createdAt`: Audit timestamp

### 3. AWB Series Service ✅

- **File**: `src/services/network-partners/implementation/smile-hubops/awb-series.service.ts`

**Key Features**:

- **Atomic Operations**: Uses MongoDB's `findOneAndUpdate` with `$inc` for thread-safe counter increments
- **Consumption Tracking**: Calculates usage percentage in real-time
- **Threshold Notifications**: Sends Discord alerts at 20%, 40%, 60%, 80%, 90%, 95%, 98%, 99%, 100%
- **Graceful Error Handling**: Logs errors but continues processing even if series is exhausted
- **Audit Trail**: Every AWB assignment is logged to audit collection

**Main Methods**:

- `getNextAwbNumber()`: Atomically increments and returns next AWB
- `calculateConsumptionPercentage()`: Calculates current usage percentage
- `checkAndSendNotifications()`: Sends Discord alerts at consumption thresholds
- `upsertSeries()`: Create or update series (for admin API)

### 4. Discord Alert Integration ✅

- **File**: `src/infrastructure/alert/discord-alert.service.ts`
- Added `sendAwbSeriesAlert()` method for AWB series notifications
- Supports multiple alert types:
  - `THRESHOLD_REACHED`: When consumption reaches notification thresholds
  - `SERIES_EXHAUSTED`: When series runs out of numbers
  - `NO_ACTIVE_SERIES`: When no active series found
  - `INCREMENT_FAILED`: When counter increment fails
- Severity levels: `info`, `warning`, `error`, `critical`

### 5. SmileHubops Service Integration ✅

- **File**: `src/services/network-partners/implementation/smile-hubops/smile-hubops.service.ts`

**createOrderV2 Enhancement**:

- Checks `orderDetails.assignAWBFromSeries` flag
- If `true`:
  1. Assigns AWB for parent shipment
  2. Assigns AWB for each child shipment (if any)
  3. Builds `trackingDetails` array with mappings
  4. Includes in response as `shipmentDetails.trackingDetails[]`
- If `false` or undefined: Uses existing behavior (backward compatible)

**Response Structure**:

```json
{
  "statusCode": 200,
  "message": "V2 Order successfully pushed to HubOps",
  "data": {
    "shipmentDetails": {
      "trackingDetails": [
        {
          "awbNumber": "25017200318430",
          "partnerAwbNumber": "25800035001",
          "partnerName": "smile_hubops",
          "transporterId": ""
        }
      ]
    }
  }
}
```

### 6. Admin API ✅

- **File**: `src/services/network-partners/implementation/smile-hubops/smile-hubops.controller.ts`
- **Endpoint**: `POST /admin/awb-series/update`

**Request Body**:

```json
{
  "partnerCode": "smile_hubops",
  "seriesStart": 25800035001,
  "seriesEnd": 25800535000,
  "isActive": true
}
```

**Response**:

```json
{
  "statusCode": 200,
  "message": "AWB series updated successfully",
  "data": {
    "id": "...",
    "partnerCode": "smile_hubops",
    "seriesStart": 25800035001,
    "seriesEnd": 25800535000,
    "currentCounter": 25800035001,
    "isActive": true,
    "totalCapacity": 500000,
    "consumed": 0,
    "remaining": 500000,
    "consumptionPercentage": "0.00",
    "notificationThresholds": [],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 7. Module Wiring ✅

- **File**: `src/services/network-partners/implementation/smile-hubops/smile-hubops.module.ts`
- Imported `AwbSeriesModule` and `AwbSeriesAuditModule`
- Added `AwbSeriesService` and `DiscordAlertService` as providers
- Registered `SmileHubopsController` for admin API

### 8. Constants Updates ✅

- **File**: `src/common/constants/repository.constant.ts`
- Added collection names: `AWB_SERIES`, `AWB_SERIES_AUDIT`
- Added model provider constants
- Added model constants

## Key Features

### 1. Thread Safety

- Uses MongoDB's atomic operations (`$inc`) for counter increments
- Prevents race conditions in concurrent order processing

### 2. Real-time Notifications

- Discord alerts at 9 consumption thresholds: 20%, 40%, 60%, 80%, 90%, 95%, 98%, 99%, 100%
- Each threshold notification sent only once
- Includes detailed consumption statistics

### 3. Comprehensive Audit Trail

- Every AWB assignment logged to audit collection
- Tracks: series ID, partner code, AWB number, order ID, consumption timestamp, AWB type
- Enables complete traceability and debugging

### 4. Graceful Error Handling

- Series exhaustion: Logs error, sends Discord alert, continues processing (doesn't fail orders)
- Missing series: Logs error, sends Discord alert, returns placeholder AWB
- Audit failures: Logged but don't block main operation

### 5. Backward Compatibility

- If `assignAWBFromSeries` is `false` or `undefined`, existing behavior is maintained
- No impact on existing orders or partners

## Usage Examples

### Creating/Updating a Series

```bash
curl -X POST http://localhost:3039/admin/awb-series/update \
  -H "Content-Type: application/json" \
  -d '{
    "partnerCode": "smile_hubops",
    "seriesStart": 25800035001,
    "seriesEnd": 25800535000,
    "isActive": true
  }'
```

### Creating an Order with AWB Series Assignment

```json
{
  "orderId": "ORD123",
  "assignAWBFromSeries": true,
  "parentShipment": {
    "awbNumber": "AWS123456"
  },
  "childShipments": [{ "awbNumber": "AWS123457" }, { "awbNumber": "AWS123458" }]
  // ... other order fields
}
```

## Testing Checklist

- [ ] Test series creation via admin API
- [ ] Test order creation with `assignAWBFromSeries: true`
- [ ] Test order creation with `assignAWBFromSeries: false`
- [ ] Test multiple shipments (parent + children)
- [ ] Verify atomic counter increments under load
- [ ] Verify Discord notifications at each threshold
- [ ] Verify audit logs are created
- [ ] Test series exhaustion handling
- [ ] Test missing series handling
- [ ] Verify backward compatibility (orders without the flag)

## Monitoring & Alerts

### Discord Alert Types

1. **Threshold Alerts**: Sent at 20%, 40%, 60%, 80%, 90%, 95%, 98%, 99%, 100%
2. **Exhaustion Alerts**: When series runs out of numbers
3. **Error Alerts**: When series not found or increment fails

### Database Collections to Monitor

1. `AwbSeries`: Track consumption rates, identify series nearing exhaustion
2. `AwbSeriesAudit`: Audit trail for troubleshooting

## Future Enhancements

1. **Multiple Active Series**: Support multiple series per partner with automatic fallback
2. **Auto-rotation**: Automatically activate next series when current exhausts
3. **Analytics Dashboard**: Real-time visualization of series consumption
4. **Series Reservation**: Reserve number ranges for specific customers/routes
5. **Bulk Operations**: APIs for bulk series management

## Files Created/Modified

### Created Files (11):

1. `src/common/repositories/awb-series/awb-series.schema.ts`
2. `src/common/repositories/awb-series/awb-series.provider.ts`
3. `src/common/repositories/awb-series/awb-series.repository.ts`
4. `src/common/repositories/awb-series/awb-series.module.ts`
5. `src/common/repositories/awb-series-audit/awb-series-audit.schema.ts`
6. `src/common/repositories/awb-series-audit/awb-series-audit.provider.ts`
7. `src/common/repositories/awb-series-audit/awb-series-audit.repository.ts`
8. `src/common/repositories/awb-series-audit/awb-series-audit.module.ts`
9. `src/services/network-partners/implementation/smile-hubops/awb-series.service.ts`
10. `src/services/network-partners/implementation/smile-hubops/smile-hubops.controller.ts`
11. `AWB_SERIES_IMPLEMENTATION_SUMMARY.md` (this file)

### Modified Files (5):

1. `src/common/dtos/base2.dto.ts`
2. `src/common/constants/repository.constant.ts`
3. `src/infrastructure/alert/discord-alert.service.ts`
4. `src/services/network-partners/implementation/smile-hubops/smile-hubops.service.ts`
5. `src/services/network-partners/implementation/smile-hubops/smile-hubops.module.ts`

## Deployment Notes

1. **Database Migration**: No migration needed - collections will be created automatically on first use
2. **Environment Variables**: No new environment variables required
3. **Dependencies**: No new external dependencies added
4. **Backward Compatibility**: ✅ Fully backward compatible

## Troubleshooting & Fixes

### Issue 1: Database Connection Dependency Error

**Error**: `Nest can't resolve dependencies of the AWB_SERIES_MODEL (?). Please make sure that the argument "DISTRIBUTOR" at index [0] is available`

**Fix**: Added `DatabaseModule` import to both `AwbSeriesModule` and `AwbSeriesAuditModule` to provide database connection.

### Issue 2: Duplicate Index Warning

**Warning**: `Duplicate schema index on {"partnerCode":1}`

**Fix**: Removed manual index declaration since `unique: true` property automatically creates an index.

### Issue 3: AwbSeriesService Dependency Resolution Error

**Error**: `Nest can't resolve dependencies of the SmileHubopsService (..., ?). Please make sure that the argument AwbSeriesService at index [5] is available in the NetworkPartnersModule context`

**Root Cause**: `SmileHubopsService` was being provided in two places:

1. In `SmileHubopsModule` (with all dependencies)
2. In `NetworkPartnersModule` via `networkPartnersProviders` array (without dependencies)

**Fix**: Changed `network-partners.provider.ts` to use `useExisting` instead of `useClass` for `SMILE_HUBOPS` provider:

```typescript
{
  provide: NETWORK_PARTNER_PROVIDER_CONST.SMILE_HUBOPS,
  useExisting: SmileHubopsService, // References the instance from SmileHubopsModule
}
```

Also exported `AwbSeriesService` from `SmileHubopsModule` for potential external use.

## Recent Updates (Error Handling & Create Endpoint)

### 1. Updated Error Handling (Throw Instead of Placeholders)

**Changed Behavior**: AWB series errors now **throw exceptions** and fail the order instead of returning placeholders.

**Updated Error Cases in `awb-series.service.ts`**:

1. **No Active Series**:

   - Status: `404 NOT_FOUND`
   - Sends Discord alert before throwing
   - Throws: `CustomHttpException` → `ApplicationFailure`

2. **Series Exhausted**:

   - Status: `409 CONFLICT`
   - Sends Discord alert with current counter and series end
   - Throws: `CustomHttpException` → `ApplicationFailure`

3. **Increment Failed**:
   - Status: `500 INTERNAL_SERVER_ERROR`
   - Sends Discord alert before throwing
   - Throws: `CustomHttpException` → `ApplicationFailure`

**Removed Placeholder Returns**:

- ❌ `NO_SERIES_${Date.now()}`
- ❌ `EXHAUSTED_${Date.now()}`
- ❌ `INCREMENT_FAILED_${Date.now()}`

### 2. Added Create Series Endpoint

**New Endpoint**: `POST /admin/awb-series/create`

**Request**:

```json
{
  "partnerCode": "smile_hubops",
  "seriesStart": 25800035001,
  "seriesEnd": 25800535000
}
```

**Success Response (201)**:

```json
{
  "statusCode": 201,
  "message": "AWB series created successfully",
  "data": {
    "id": "...",
    "partnerCode": "smile_hubops",
    "seriesStart": 25800035001,
    "seriesEnd": 25800535000,
    "currentCounter": 25800035001,
    "isActive": true,
    "totalCapacity": 500000,
    "consumed": 0,
    "remaining": 500000,
    "consumptionPercentage": "0.00",
    "notificationThresholds": [],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error Cases**:

- **Series Already Exists**: `409 CONFLICT` - "AWB series already exists for partner: {partnerCode}. Use update endpoint to modify existing series."
- **Invalid Range**: `400 BAD_REQUEST` - "Series end must be greater than series start"

**New Methods Added**:

- `AwbSeriesRepository.createSeries()` - Creates new series, checks for duplicates
- `AwbSeriesService.createSeries()` - Validates and creates series
- `SmileHubopsController.createAwbSeries()` - HTTP endpoint handler

**DTOs**:

- `CreateAwbSeriesDto` - For creating new series (partnerCode, seriesStart, seriesEnd)
- `UpdateAwbSeriesDto` - For updating existing series (includes optional isActive)

### 3. Separation of Create vs Update

| Endpoint                        | Purpose                    | Behavior                       |
| ------------------------------- | -------------------------- | ------------------------------ |
| `POST /admin/awb-series/create` | Create **new** series      | Fails if series exists         |
| `POST /admin/awb-series/update` | Update **existing** series | Creates if not exists (upsert) |

### 4. Performance Optimization - Single Atomic Query

**Optimization**: Reduced database queries from 2 to 1 for AWB increment operation.

**Before (2 Queries)**:

```typescript
// Query 1: Get active series
const activeSeries = await getActiveSeriesForPartner(partnerCode);
// Check if exists and not exhausted
if (!activeSeries) { throw... }
if (activeSeries.currentCounter > seriesEnd) { throw... }

// Query 2: Increment counter
const updatedSeries = await incrementCounter(partnerCode);
```

**After (1 Query)**:

```typescript
// Single atomic operation with built-in exhaustion check
const updatedSeries = await incrementCounter(partnerCode);
if (!updatedSeries) {
  // Diagnose reason: no series, exhausted, or other failure
}
```

**Repository Query Enhancement**:

```typescript
findOneAndUpdate(
  {
    partnerCode,
    isActive: true,
    $expr: { $lte: ["$currentCounter", "$seriesEnd"] }, // Built-in exhaustion check
  },
  { $inc: { currentCounter: 1 } },
  { new: true }
);
```

**Benefits**:

- ✅ **50% Reduction** in database queries (2 → 1)
- ✅ **True Atomicity** - No race condition between check and increment
- ✅ **Better Performance** - Single round trip to database
- ✅ **Improved Scalability** - Better under high concurrency
- ✅ **Same Error Handling** - Still provides detailed error messages via diagnosis fetch

**Error Diagnosis**:
When increment returns `null`, a single diagnostic query determines if it's:

- No active series → 404
- Series exhausted → 409
- Other failure → 500

This diagnostic query only runs on failures, not on the success path.

## Status: ✅ COMPLETED

All implementation tasks completed successfully with zero linter errors. Application starts without errors.

### 5. Critical Fix - Series Assignment After API Success

**Issue**: Series numbers were being consumed BEFORE confirming HubOps API success, wasting numbers on failures.

**Before (WRONG)**:

```typescript
1. Assign AWB from series → consumes number
2. Call HubOps API → may fail
3. If fail → number wasted! ❌
```

**After (CORRECT)**:

```typescript
1. Call HubOps API with existing AWB
2. If success → Assign AWB from series ✅
3. If fail → No number consumed ✅
```

**Implementation**:

```typescript
// Make the API call first
const response = await this.makeHubOpsApiCall(endpoint.url, hubOpsPayload, "HubOps V2");

// Check if API failed
if (originalResponse && originalResponse.statusCode !== 200) {
  // Return error WITHOUT consuming series number
  return this.createSuccessResponse<R>(response.data, "...with API errors...");
}

// SUCCESS - NOW assign AWB numbers from series
if (orderDetails.assignAWBFromSeries === true) {
  const parentPartnerAwb = await this.awbSeriesService.getNextAwbNumber(...);
  // Add to trackingDetails in response
}
```

**Result**: Series numbers only consumed on successful HubOps API calls, preventing waste.

**Latest Updates**:

1. Error handling now throws exceptions instead of placeholders
2. Separate create endpoint added for initial series setup
3. **Performance optimized** - Single atomic query reduces DB calls by 50%
4. **Critical fix** - Series only consumed AFTER successful API response
