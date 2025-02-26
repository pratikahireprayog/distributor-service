export enum RiskType {
  OwnerRisk = 'OwnerRisk',
  CarrierRisk = 'CarrierRisk',
  ThirdPartyInsurance = 'ThirdPartyInsurance'
}

export enum PaymentType {
  COD = 'COD',
  Prepaid = 'PrePaid',
  ToPay = 'ToPay',
}

export enum ShipmentCategory {
  B2C = 'B2C',
  B2B = 'B2B',
}

export enum HeavyOrderAllowedShipmentCategory {
  B2B = 'b2b',
}

export enum CalculatorShipmentCategory {
  B2C = 'b2c',
  B2B = 'b2b',
}

export enum Base64DataPrefix {
  Image = "data:image/jpeg;base64,",
  PDF = "data:application/pdf;base64,/9j/"
}

// Product category enumeration for validation
export enum ProductCategory {
  Accessories = 'Accessories',
  FashionClothing = 'FashionClothing',
  BookStationary = 'BookStationary',
  Electronics = 'Electronics',
  FMCG = 'FMCG',
  Footwear = 'Footwear',
  SportsEquipment = 'SportsEquipment',
  Toys = 'Toys',
  Others = 'Others',
  Wellness = 'Wellness',
  Medicines = 'Medicines',
}

//BigShip Urls
export enum BigshipEndPoints {
  SHIPMENT_DATA_ENDPOINT = '/shipment/data',
  CANCEL_ORDER_ENDPOINT = '/order/cancel',
  TRACKING_ENDPOINT = '/tracking',
  COURIER_ENDPOINT = '/courier/get/all',
  MANIFEST_HEAVY_ENDPOINT = '/order/manifest/heavy',
  ADD_WAREHOUSE_ENDPOINT = '/warehouse/add',
  RATE_CALCULATE_ENDPOINT = '/calculator',
  ADD_HEAVY_ORDER_ENDPOINT = '/order/add/heavy',
  ORDER_SHIPPING_RATE_ENDPOINT = '/order/shipping/rates',
  UPDATE_DOCUMENT_EWAYBILL_ENDPOINT = '/order/update/document?document_type=ewaybill',
}

export enum fulfillmentEndPoints {
  ORDER_FULFILLMENT = '/fulfillment/public/seller/order/',
}

export enum cancelAwbCancelResponseMessages {
  SUCCESS = "Successfully Cancelled",
  NOT_FOUND = null,
  CANCELLED = "Cancellation Request is not Accepted"
}
export enum cancelAwbResponseMessages {
  SUCCESS = "Successfully Processed",
  NOT_FOUND = "AWBs Not Found"
}

export enum INNO_FULL_FILL_ORDER_STATUS_TYPE {
  RECEIVED = 'RECEIVED',
  UPDATING = 'UPDATING',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_PROCESS = 'IN_PROCESS',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
  READY_FOR_DISPATCH = 'READY_FOR_DISPATCH',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  ARRIVED = 'ARRIVED',
  CANCELLED_BY_SHIPPER = 'CANCELLED_BY_SHIPPER',
  CANCELLED_BY_CUSTOMER = 'CANCELLED_BY_CUSTOMER',
  ERROR_ORDER = 'ERROR_ORDER',
  RTO_INITIATED = 'RTO_INITIATED',
  RTO_DELIVERED = 'RTO_DELIVERED',
  RTO = 'RTO',
  DELIVERED_BY_SHIPPER = 'DELIVERED_BY_SHIPPER',
  PICKED_UP = 'PICKED_UP',
  ARRIVED_FOR_PICKUP = 'ARRIVED_FOR_PICKUP',
  IN_TRANSIT = 'IN_TRANSIT',
  UNDELIVERED = 'UNDELIVERED',
  LOST = 'LOST',
  CANCELLED_BY_SELLER = 'CANCELLED_BY_SELLER',
  CANCELLED = 'CANCELLED',
  CANCELED = 'CANCELED'
}