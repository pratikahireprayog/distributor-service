# SOLID Principles Applied to Order Calculation Utils

## Overview

Applied selected SOLID principles to improve the utility functions without over-complicating the structure. All functions remain in a single file but are better organized and more maintainable.

## Applied SOLID Principles

### 1. Single Responsibility Principle (SRP) ✅

**Organized code into logical sections by responsibility:**

- **VALUE CALCULATIONS**: Functions for calculating shipment values
- **WEIGHT CALCULATIONS**: Functions for different weight calculation strategies
- **DIMENSION CALCULATIONS**: Functions for handling dimensions
- **CORE PROCESSOR**: Common calculation logic

### 2. Open/Closed Principle (OCP) ✅

**Made weight calculations extensible without modifying existing code:**

```typescript
enum WeightCalculationType {
  PHYSICAL = "physical",
  VOLUMETRIC = "volumetric",
  ITEM_BASED = "itemBased",
  MAX = "max"
}

// Easy to add new strategies without changing existing code
static calculateWeight(orderV2, strategy = WeightCalculationType.MAX, options = {})
```

### 3. Interface Segregation Principle (ISP) ✅

**Created focused interfaces instead of many individual parameters:**

```typescript
interface CalculationOptions {
  returnDefault?: boolean;
  defaultValue?: number;
  returnMax?: boolean;
}

// Before: Multiple parameters
calculateTotalValue(orderV2, returnDefault, defaultValue, returnMax)

// After: Clean interface
calculateTotalShipmentValue(orderV2, options: CalculationOptions = {})
```

### 4. Dependency Inversion Principle (DIP) ✅

**Created common abstraction for all calculations:**

```typescript
private static processCalculation(
  calculationFn: () => number,
  staticDefault: number,
  options: CalculationOptions
): number
```

## Benefits Achieved

### ✅ **Maintainability**

- Clear separation of concerns
- Consistent calculation logic
- Single place to modify default handling

### ✅ **Extensibility**

- Easy to add new weight calculation strategies
- Easy to add new calculation options
- Backward compatible with existing code

### ✅ **Consistency**

- All calculations use the same default value logic
- Unified interface for configuration
- Consistent error handling

### ✅ **Simplicity**

- Kept everything in one file (no over-engineering)
- Cleaner method signatures
- Better organized code structure

## Usage Examples

```typescript
// Simple usage (backward compatible)
const value = OrderCalculationUtils.calculateTotalShipmentValue(orderV2);
const weight = OrderCalculationUtils.calculateMaxWeight(orderV2);

// With custom options
const value = OrderCalculationUtils.calculateTotalShipmentValue(orderV2, {
  defaultValue: 500,
  returnMax: true,
});

// Using specific weight strategy
const weight = OrderCalculationUtils.calculateWeight(
  orderV2,
  WeightCalculationType.PHYSICAL,
  { defaultValue: 2 }
);

// New dimension methods
const dimensions = OrderCalculationUtils.getDimensions(orderV2, {
  defaultValue: 5,
  returnMax: true,
});
```

## Principles NOT Applied (Intentionally)

### ❌ **Liskov Substitution Principle**

- Not applicable for utility functions
- Would add unnecessary complexity

### ❌ **Separate Files per Function**

- Would over-complicate for utilities
- Better to keep related functions together

This strikes the right balance between applying good design principles and maintaining simplicity for utility functions.
