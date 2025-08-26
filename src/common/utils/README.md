# Order Calculation Utilities

This module provides reusable utility functions for calculating order values, weights, and dimensions across all network partners.

## OrderCalculationUtils

### Value Calculation

#### `calculateTotalValue(orderV2: BaseOrderReqDtoV2): number`

Calculates the total order value by summing up all `unitPrice` from items in both parent and child shipments.

- Multiplies `unitPrice` by `quantity` for each item
- Handles both string and number types for unitPrice
- Falls back to `payment.finalAmount` if no items value is calculated
- Returns total value as number

**Example:**

```typescript
const totalValue = OrderCalculationUtils.calculateTotalValue(orderV2);
// Returns sum of all (unitPrice * quantity) from all items
```

### Weight Calculation

#### `calculateMaxWeight(orderV2: BaseOrderReqDtoV2): number`

Calculates the maximum weight from three different sources:

1. Sum of all shipments' `physicalWeight`
2. Sum of all shipments' `volumetricWeight`
3. Sum of all items' `weight` (multiplied by quantity)

Returns the maximum of these three calculations.

**Example:**

```typescript
const maxWeight = OrderCalculationUtils.calculateMaxWeight(orderV2);
// Returns max(physicalWeights, volumetricWeights, itemsWeights)
```

#### `getWeightWithDefault(orderV2: BaseOrderReqDtoV2, minWeight: number = 1): number`

Gets the calculated max weight but applies a minimum default if weight is 0 or invalid.

**Example:**

```typescript
const weight = OrderCalculationUtils.getWeightWithDefault(orderV2, 2);
// Returns calculated weight or 2 if calculated weight is 0
```

#### `getPhysicalWeightWithDefault(orderV2: BaseOrderReqDtoV2, minWeight: number = 1): number`

Gets total physical weight with minimum default applied.

#### `getVolumetricWeightWithDefault(orderV2: BaseOrderReqDtoV2, minWeight: number = 1): number`

Gets total volumetric weight with minimum default applied.

### Dimension Handling

#### `getDimensionWithDefault(dimension: number | undefined, minDimension: number = 1): number`

Gets a single dimension value with minimum default applied if dimension is 0 or undefined.

**Example:**

```typescript
const length = OrderCalculationUtils.getDimensionWithDefault(
  orderV2.parentShipment?.dimensions?.length,
  2
);
// Returns actual length or 2 if length is 0/undefined
```

#### `getDimensionsWithDefaults(orderV2: BaseOrderReqDtoV2, minDimension: number = 1)`

Gets all dimensions (length, width, height) with minimum defaults applied.

**Example:**

```typescript
const dimensions = OrderCalculationUtils.getDimensionsWithDefaults(orderV2, 2);
// Returns { length: 10, width: 5, height: 2 } (where height was 0 so got default)
```

## Why Use These Utilities?

1. **Consistency**: All partners use the same calculation logic
2. **Maintenance**: Update calculation logic in one place
3. **Default Handling**: Many partners don't accept 0 values, so minimum defaults ensure compatibility
4. **Type Safety**: Handles both string and number types safely
5. **Comprehensive**: Considers all sources of weight/value data

## Usage in Network Partners

```typescript
import { OrderCalculationUtils } from "src/common/utils";

// In your partner service
const payload = {
  value: OrderCalculationUtils.calculateTotalValue(orderV2),
  weight: OrderCalculationUtils.getWeightWithDefault(orderV2),
  length: OrderCalculationUtils.getDimensionWithDefault(
    orderV2.parentShipment?.dimensions?.length
  ),
  width: OrderCalculationUtils.getDimensionWithDefault(
    orderV2.parentShipment?.dimensions?.width
  ),
  height: OrderCalculationUtils.getDimensionWithDefault(
    orderV2.parentShipment?.dimensions?.height
  ),
  volumetricWeight:
    OrderCalculationUtils.getVolumetricWeightWithDefault(orderV2),
};
```

This ensures all partners calculate values consistently and handle edge cases properly.
