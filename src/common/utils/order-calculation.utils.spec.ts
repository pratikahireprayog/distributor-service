import { OrderCalculationUtils } from "./order-calculation.utils";
import { BaseOrderReqDtoV2 } from "../dtos/base2.dto";

describe("OrderCalculationUtils", () => {
  const mockOrderV2: BaseOrderReqDtoV2 = {
    orderId: "test-123",
    referenceId: "ref-123",
    parcelCategory: "COURIER",
    orderDate: "2025-01-01T00:00:00.000Z",
    expectedDeliveryDate: "2025-01-02T00:00:00.000Z",
    orderType: "FORWARD",
    eWaybills: ["12345", "67890"],
    autoManifest: true,
    returnable: false,
    deliveryMode: "SURFACE",
    serviceType: "STANDARD",
    orderStatus: "CONFIRMED",
    taxes: [],
    discounts: [],
    metadata: {
      source: "TEST",
      createdBy: "test-user",
    },
    addresses: [],
    documents: [],
    parentShipment: {
      id: 1,
      orderId: 1,
      awbNumber: "parent-123",
      dimensions: {
        width: 10,
        height: 15,
        length: 20,
      },
      physicalWeight: "2",
      volumetricWeight: "1.5",
      note: "Test shipment",
      items: [
        {
          id: 1,
          shipmentId: 1,
          name: "Test Item 1",
          quantity: 2,
          weight: "0.5",
          unitPrice: "100",
          sku: "SKU1",
          hsnCode: "HSN1",
          description: "Test item 1",
          taxes: [],
          discounts: [],
        },
      ],
    },
    childShipments: [
      {
        awbNumber: "child-123",
        physicalWeight: "1",
        volumetricWeight: "0.8",
        items: [
          {
            id: 2,
            shipmentId: 2,
            name: "Test Item 2",
            quantity: 1,
            weight: "0.3",
            unitPrice: "50",
            sku: "SKU2",
            hsnCode: "HSN2",
            description: "Test item 2",
            taxes: [],
            discounts: [],
          },
        ],
      },
    ],
    vehicles: [],
    slots: [],
    payment: {
      id: 1,
      orderId: 1,
      finalAmount: "300",
      type: "COD",
      status: "PENDING",
      currency: "INR",
      paymentMethod: "COD",
      transactionId: "",
      breakdown: {
        id: 1,
        paymentId: 1,
        subTotal: "300",
        taxes: [],
        discounts: [],
        otherCharges: [],
      },
      splitPayments: [],
    },
    awbNumber: "parent-123",
    partnerCode: "SMILE_HUBOPS",
    workflowId: "workflow-123",
    operation: "createOrder",
    workflowContext: {
      userId: "user-123",
      apiVersion: "v2",
      source: "TEST",
    },
    partner: {
      code: "SMILE_HUBOPS",
      id: "partner-123",
    },
  } as any;

  describe("calculateTotalShipmentValue", () => {
    it("should calculate total value from all items", () => {
      const totalValue =
        OrderCalculationUtils.calculateTotalShipmentValue(mockOrderV2);
      // Parent: 2 * 100 = 200, Child: 1 * 50 = 50, Total = 250
      expect(totalValue).toBe(250);
    });

    it("should fallback to payment finalAmount if no items value", () => {
      const orderWithoutItems = { ...mockOrderV2 };
      orderWithoutItems.parentShipment.items = [];
      orderWithoutItems.childShipments = [];

      const totalValue =
        OrderCalculationUtils.calculateTotalShipmentValue(orderWithoutItems);
      expect(totalValue).toBe(300); // payment.finalAmount
    });

    it("should use custom default with returnDefault flag", () => {
      const totalValue = OrderCalculationUtils.calculateTotalShipmentValue(
        mockOrderV2,
        { returnDefault: true, defaultValue: 500 }
      );
      expect(totalValue).toBe(500);
    });

    it("should return max of calculated and default with returnMax flag", () => {
      const totalValue = OrderCalculationUtils.calculateTotalShipmentValue(
        mockOrderV2,
        { returnMax: true, defaultValue: 300 }
      );
      expect(totalValue).toBe(300); // Max of 250 (calculated) and 300 (default)
    });
  });

  describe("calculateMaxWeight", () => {
    it("should return maximum weight from the three calculations", () => {
      const maxWeight = OrderCalculationUtils.calculateMaxWeight(mockOrderV2);
      // Physical: 2 + 1 = 3, Volumetric: 1.5 + 0.8 = 2.3, Items: (2*0.5) + (1*0.3) = 1.3
      // Max should be 3
      expect(maxWeight).toBe(3);
    });
  });

  describe("calculateWeight", () => {
    it("should return calculated weight when greater than 0", () => {
      const weight = OrderCalculationUtils.calculateMaxWeight(mockOrderV2);
      expect(weight).toBe(3);
    });

    it("should return default when weight is 0", () => {
      const orderWithZeroWeight = { ...mockOrderV2 };
      orderWithZeroWeight.parentShipment.physicalWeight = 0 as any;
      orderWithZeroWeight.parentShipment.volumetricWeight = 0 as any;
      orderWithZeroWeight.parentShipment.items = [];
      orderWithZeroWeight.childShipments = [];

      const weight = OrderCalculationUtils.calculateMaxWeight(
        orderWithZeroWeight,
        { defaultValue: 2 }
      );
      expect(weight).toBe(2);
    });
  });

  describe("getDimension", () => {
    it("should return dimension when greater than 0", () => {
      const dimension = OrderCalculationUtils.getDimension(10);
      expect(dimension).toBe(10);
    });

    it("should return default when dimension is 0 or undefined", () => {
      expect(OrderCalculationUtils.getDimension(0, { defaultValue: 2 })).toBe(
        2
      );
      expect(
        OrderCalculationUtils.getDimension(undefined, { defaultValue: 3 })
      ).toBe(3);
    });
  });

  describe("getDimensions", () => {
    it("should return all dimensions with defaults applied", () => {
      const dimensions = OrderCalculationUtils.getDimensions(mockOrderV2);
      expect(dimensions).toEqual({
        length: 20,
        width: 10,
        height: 15,
      });
    });

    it("should apply defaults for zero dimensions", () => {
      const orderWithZeroDimensions = { ...mockOrderV2 };
      orderWithZeroDimensions.parentShipment.dimensions = {
        width: 0,
        height: 0,
        length: 0,
      };

      const dimensions = OrderCalculationUtils.getDimensions(
        orderWithZeroDimensions,
        { defaultValue: 2 }
      );
      expect(dimensions).toEqual({
        length: 2,
        width: 2,
        height: 2,
      });
    });
  });
});
