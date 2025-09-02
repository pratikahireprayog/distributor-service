import { BaseOrderReqDtoV2 } from "../dtos/base2.dto";

/**
 * Configuration interface for calculation options
 */
interface CalculationOptions {
  returnDefault?: boolean;
  defaultValue?: number;
  returnMax?: boolean;
}

/**
 * Weight calculation strategies
 */
enum WeightCalculationType {
  PHYSICAL = "physical",
  VOLUMETRIC = "volumetric",
  ITEM_BASED = "itemBased",
  MAX = "max",
}

/**
 * Utility functions for order calculations used across network partners
 * Organized following SRP - separated by calculation type responsibility
 */
export class OrderCalculationUtils {
  // =============================================================================
  // VALUE CALCULATIONS (SRP: Single responsibility for value-related calculations)
  // =============================================================================

  /**
   * Calculate total shipment value by summing up all unitPrice from items in parent and child shipments
   * @param orderV2 - The V2 order object
   * @param options - Calculation options for default handling
   * @returns Total value from all items or default based on options
   */
  static calculateTotalShipmentValue(
    orderV2: BaseOrderReqDtoV2,
    options: CalculationOptions = {}
  ): number {
    return this.processCalculation(
      () => this.calculateValueFromItems(orderV2),
      1, // Default value for shipment value
      options
    );
  }

  /**
   * Internal method to calculate value from all items
   */
  private static calculateValueFromItems(orderV2: BaseOrderReqDtoV2): number {
    let totalValue = 0;

    // Add parent shipment items value
    if (orderV2.parentShipment?.items) {
      totalValue += orderV2.parentShipment.items.reduce((sum, item) => {
        const unitPrice =
          typeof item.unitPrice === "string"
            ? parseFloat(item.unitPrice) || 0
            : item.unitPrice || 0;
        const quantity = item.quantity || 1;
        return sum + unitPrice * quantity;
      }, 0);
    }

    // Add child shipments items value
    if (orderV2.childShipments) {
      orderV2.childShipments.forEach((childShipment: any) => {
        if (childShipment.items) {
          totalValue += childShipment.items.reduce((sum: number, item: any) => {
            const unitPrice =
              typeof item.unitPrice === "string"
                ? parseFloat(item.unitPrice) || 0
                : item.unitPrice || 0;
            const quantity = item.quantity || 1;
            return sum + unitPrice * quantity;
          }, 0);
        }
      });
    }

    // Fallback to payment finalAmount if no items value calculated
    if (totalValue === 0 && orderV2.payment?.finalAmount) {
      totalValue =
        typeof orderV2.payment.finalAmount === "string"
          ? parseFloat(orderV2.payment.finalAmount) || 0
          : orderV2.payment.finalAmount || 0;
    }

    return totalValue;
  }

  /**
   * Calculate maximum weight from three sources:
   * 1. Sum of all shipments' physicalWeight
   * 2. Sum of all shipments' volumetricWeight
   * 3. Sum of all items' weight
   * @param orderV2 - The V2 order object
   * @param returnDefault - If true, return default value instead of calculated
   * @param defaultValue - Custom default value (if not provided, uses static default)
   * @param returnMax - If true, return max of calculated and default values
   * @returns Maximum weight value or default based on flags
   */
  static calculateMaxWeight(
    orderV2: BaseOrderReqDtoV2,
    options: CalculationOptions = {}
  ): number {
    const calculationMethod = () => {
      const physicalWeight = this.calculatePhysicalWeight(orderV2);
      const volumetricWeight = this.calculateVolumetricWeight(orderV2);
      const itemWeight = this.calculateItemBasedWeight(orderV2);
      return Math.max(physicalWeight, volumetricWeight, itemWeight);
    };

    return this.processCalculation(calculationMethod, 1, options);
  }

  /**
   * Get dimension with default value handling
   * @param dimension - The dimension value
   * @param returnDefault - If true, return default value instead of calculated
   * @param defaultValue - Custom default value (if not provided, uses static default)
   * @param returnMax - If true, return max of calculated and default values
   * @returns Dimension value or default based on flags
   */
  static getDimensionWithDefault(
    dimension: number | undefined,
    returnDefault: boolean = false,
    defaultValue?: number,
    returnMax: boolean = false
  ): number {
    const finalDefault = defaultValue ?? 1;

    if (returnDefault) {
      return finalDefault;
    }

    const calculatedDimension = dimension || 0;

    // Apply default value logic if needed
    if (defaultValue !== undefined) {
      if (returnMax) {
        return Math.max(calculatedDimension, finalDefault);
      } else {
        return calculatedDimension > 0 ? calculatedDimension : finalDefault;
      }
    }

    return calculatedDimension > 0 ? calculatedDimension : 1;
  }

  /**
   * Get all dimensions with default value handling
   * @param orderV2 - The V2 order object
   * @param returnDefault - If true, return default values instead of calculated
   * @param defaultValue - Custom default value (if not provided, uses static default)
   * @param returnMax - If true, return max of calculated and default values
   * @returns Object with length, width, height with defaults applied
   */
  static getDimensionsWithDefaults(
    orderV2: BaseOrderReqDtoV2,
    returnDefault: boolean = false,
    defaultValue?: number,
    returnMax: boolean = false
  ) {
    const dimensions = orderV2.parentShipment?.dimensions;

    return {
      length: this.getDimensionWithDefault(
        dimensions?.length,
        returnDefault,
        defaultValue,
        returnMax
      ),
      width: this.getDimensionWithDefault(
        dimensions?.width,
        returnDefault,
        defaultValue,
        returnMax
      ),
      height: this.getDimensionWithDefault(
        dimensions?.height,
        returnDefault,
        defaultValue,
        returnMax
      ),
    };
  }

  /**
   * Get volumetric weight with default value handling
   * @param orderV2 - The V2 order object
   * @param returnDefault - If true, return default value instead of calculated
   * @param defaultValue - Custom default value (if not provided, uses static default)
   * @param returnMax - If true, return max of calculated and default values
   * @returns Volumetric weight with default applied based on flags
   */
  static getVolumetricWeightWithDefault(
    orderV2: BaseOrderReqDtoV2,
    returnDefault: boolean = false,
    defaultValue?: number,
    returnMax: boolean = false
  ): number {
    const finalDefault = defaultValue ?? 1;

    if (returnDefault) {
      return finalDefault;
    }

    let totalVolumetricWeight = 0;

    if (orderV2.parentShipment?.volumetricWeight) {
      totalVolumetricWeight +=
        typeof orderV2.parentShipment.volumetricWeight === "string"
          ? parseFloat(orderV2.parentShipment.volumetricWeight) || 0
          : orderV2.parentShipment.volumetricWeight || 0;
    }

    if (orderV2.childShipments) {
      orderV2.childShipments.forEach((childShipment: any) => {
        if (childShipment.volumetricWeight) {
          totalVolumetricWeight +=
            typeof childShipment.volumetricWeight === "string"
              ? parseFloat(childShipment.volumetricWeight) || 0
              : childShipment.volumetricWeight || 0;
        }
      });
    }

    // Apply default value logic if needed
    if (defaultValue !== undefined) {
      if (returnMax) {
        return Math.max(totalVolumetricWeight, finalDefault);
      } else {
        return totalVolumetricWeight > 0 ? totalVolumetricWeight : finalDefault;
      }
    }

    return totalVolumetricWeight > 0 ? totalVolumetricWeight : 1;
  }

  /**
   * Get physical weight with minimum default
   * @param orderV2 - The V2 order object
   * @param minWeight - Minimum weight default (default: 1)
   * @returns Physical weight with minimum default applied
   */
  static getPhysicalWeightWithDefault(
    orderV2: BaseOrderReqDtoV2,
    minWeight: number = 1
  ): number {
    let totalPhysicalWeight = 0;

    if (orderV2.parentShipment?.physicalWeight) {
      totalPhysicalWeight +=
        typeof orderV2.parentShipment.physicalWeight === "string"
          ? parseFloat(orderV2.parentShipment.physicalWeight) || 0
          : orderV2.parentShipment.physicalWeight || 0;
    }

    if (orderV2.childShipments) {
      orderV2.childShipments.forEach((childShipment: any) => {
        if (childShipment.physicalWeight) {
          totalPhysicalWeight +=
            typeof childShipment.physicalWeight === "string"
              ? parseFloat(childShipment.physicalWeight) || 0
              : childShipment.physicalWeight || 0;
        }
      });
    }

    return totalPhysicalWeight > 0 ? totalPhysicalWeight : minWeight;
  }

  // =============================================================================
  // CORE CALCULATION PROCESSOR (DIP: Common abstraction for all calculations)
  // =============================================================================

  /**
   * Common calculation processor implementing consistent default value logic
   * @param calculationFn - Function that performs the actual calculation
   * @param staticDefault - Default value to use when no custom default provided
   * @param options - Calculation options
   * @returns Processed calculation result
   */
  private static processCalculation(
    calculationFn: () => number,
    staticDefault: number,
    options: CalculationOptions
  ): number {
    const { returnDefault = false, defaultValue, returnMax = false } = options;
    const finalDefault = defaultValue ?? staticDefault;

    if (returnDefault) {
      return finalDefault;
    }

    const calculatedValue = calculationFn();

    // Apply default value logic if custom default is provided
    if (defaultValue !== undefined) {
      if (returnMax) {
        return Math.max(calculatedValue, finalDefault);
      } else {
        return calculatedValue > 0 ? calculatedValue : finalDefault;
      }
    }

    // Use static default for zero values
    return calculatedValue > 0 ? calculatedValue : staticDefault;
  }

  // =============================================================================
  // DIMENSION CALCULATIONS (SRP: Single responsibility for dimension calculations)
  // =============================================================================

  /**
   * Get single dimension with default handling
   * @param dimension - The dimension value
   * @param options - Calculation options for default handling
   * @returns Dimension value with defaults applied
   */
  static getDimension(
    dimension: number | undefined,
    options: CalculationOptions = {}
  ): number {
    return this.processCalculation(
      () => dimension || 0,
      1, // Default dimension in cm
      options
    );
  }

  /**
   * Get all dimensions with default handling
   * @param orderV2 - The V2 order object
   * @param options - Calculation options for default handling
   * @returns Object with length, width, height with defaults applied
   */
  static getDimensions(
    orderV2: BaseOrderReqDtoV2,
    options: CalculationOptions = {}
  ) {
    const dimensions = orderV2.parentShipment?.dimensions;

    return {
      length: this.getDimension(dimensions?.length, options),
      width: this.getDimension(dimensions?.width, options),
      height: this.getDimension(dimensions?.height, options),
    };
  }

  // =============================================================================
  // WEIGHT CALCULATION STRATEGIES (SRP + OCP: Extensible weight calculations)
  // =============================================================================

  /**
   * Calculate physical weight from shipments
   */
  private static calculatePhysicalWeight(orderV2: BaseOrderReqDtoV2): number {
    let totalWeight = 0;

    if (orderV2.parentShipment?.physicalWeight) {
      totalWeight += this.parseWeight(orderV2.parentShipment.physicalWeight);
    }

    if (orderV2.childShipments) {
      orderV2.childShipments.forEach((child: any) => {
        if (child.physicalWeight) {
          totalWeight += this.parseWeight(child.physicalWeight);
        }
      });
    }

    return totalWeight;
  }

  /**
   * Calculate volumetric weight from shipments
   */
  private static calculateVolumetricWeight(orderV2: BaseOrderReqDtoV2): number {
    let totalWeight = 0;

    if (orderV2.parentShipment?.volumetricWeight) {
      totalWeight += this.parseWeight(orderV2.parentShipment.volumetricWeight);
    }

    if (orderV2.childShipments) {
      orderV2.childShipments.forEach((child: any) => {
        if (child.volumetricWeight) {
          totalWeight += this.parseWeight(child.volumetricWeight);
        }
      });
    }

    return totalWeight;
  }

  /**
   * Calculate weight from items
   */
  private static calculateItemBasedWeight(orderV2: BaseOrderReqDtoV2): number {
    let totalWeight = 0;

    if (orderV2.parentShipment?.items) {
      totalWeight += orderV2.parentShipment.items.reduce((sum, item) => {
        const weight = this.parseWeight(item.weight);
        const quantity = item.quantity || 1;
        return sum + weight * quantity;
      }, 0);
    }

    if (orderV2.childShipments) {
      orderV2.childShipments.forEach((child: any) => {
        if (child.items) {
          totalWeight += child.items.reduce((sum: number, item: any) => {
            const weight = this.parseWeight(item.weight);
            const quantity = item.quantity || 1;
            return sum + weight * quantity;
          }, 0);
        }
      });
    }

    return totalWeight;
  }

  /**
   * Helper method to parse weight values (handles string/number conversion)
   */
  private static parseWeight(weight: string | number | undefined): number {
    if (typeof weight === "string") {
      return parseFloat(weight) || 0;
    }
    return weight || 0;
  }
}
