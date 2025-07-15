import { Type } from "class-transformer";
import { ORDER_STATUS_ENUM, ORDER_TYPE_ENUM } from "../enums/global.enum";
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  ValidateNested,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsArray,
} from "class-validator";

export class BaseReqDto {
  @IsNotEmpty({ message: "AWB number is required" })
  @IsString({ message: "AWB number must be a string" })
  awbNumber: string;

  @IsOptional()
  @IsString({ message: "Partner code must be a string" })
  partnerCode: string;
}

export class MetadataDto {
  @IsString()
  source: string;

  @IsString()
  createdBy: string;
}

/**
 * Address information used in various DTOs
 */
export class AddressDto {
  /**
   * Name of the recipient/sender
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Mobile contact number
   */
  @IsString()
  @IsNotEmpty()
  mobile: string;

  /**
   * Email address
   */
  @IsOptional()
  @IsString()
  email?: string;

  /**
   * Primary address line
   */
  @IsString()
  @IsNotEmpty()
  address1: string;

  /**
   * Secondary address line
   */
  @IsString()
  @IsOptional()
  address2: string = "";

  /**
   * City name
   */
  @IsString()
  @IsNotEmpty()
  city: string;

  /**
   * State name
   */
  @IsString()
  @IsNotEmpty()
  state: string;

  /**
   * Country name
   */
  @IsString()
  @IsNotEmpty()
  country: string;
  @IsString()
  @IsOptional()
  countryCode?: string;

  /**
   * ZIP/Postal code
   */
  @IsString()
  @IsNotEmpty()
  zip: string;

  /**
   * Latitude coordinate
   */
  @IsNumber()
  @IsNotEmpty()
  latitude: number = 0;

  /**
   * Longitude coordinate
   */
  @IsNumber()
  @IsNotEmpty()
  longitude: number = 0;
}

export class SellerInfoDto {
  /**
   * Name of the seller
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Mobile number of the seller
   */
  @IsString()
  @IsNotEmpty()
  mobile: string;

  /**
   * Company name of the seller
   */
  @IsString()
  @IsNotEmpty()
  companyName: string;

  /**
   * Vendor code of the seller
   */
  @IsString()
  @IsNotEmpty()
  vendorCode: string;
}

/**
 * Delivery promise information
 */
export class DeliveryPromiseDto {
  /**
   * Short code for delivery promise (e.g., "ONE_DAY_DELIVERY")
   */
  @IsString()
  @IsNotEmpty()
  shortCode: string;
}

/**
 * Payment details information
 */
export class PaymentDetailsDto {
  /**
   * Payment amount
   */
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  /**
   * Whether payment is Cash on Delivery
   */
  @IsBoolean()
  @IsNotEmpty()
  isCOD: boolean;
}

/**
 * Package dimensions information
 */
export class DimensionsDto {
  /**
   * Weight in kg
   */
  @IsNumber()
  @IsNotEmpty()
  weight: number;

  /**
   * Length in cm
   */
  @IsNumber()
  @IsOptional()
  length?: number;

  /**
   * Breadth/width in cm
   */
  @IsNumber()
  @IsOptional()
  breadth?: number;

  /**
   * Height in cm
   */
  @IsNumber()
  @IsOptional()
  height?: number;
}

/**
 * Core Order data structure
 * This represents the fundamental Order entity used across the application
 */
export class OrderDto {
  /**
   * Air Waybill (AWB) number that uniquely identifies an order
   */
  @IsString()
  @IsNotEmpty()
  awbNumber: string;

  /**
   * Carrier/partner AWB number (when applicable)
   */
  @IsString()
  @IsOptional()
  cAwbNumber?: string;

  /**
   * Name of the carrier handling the order
   */
  @IsString()
  @IsOptional()
  carrierName?: string;

  /**
   * Partner code (similar to carrier name, will eventually replace it)
   */
  @IsString()
  @IsOptional()
  partnerCode?: string;

  /**
   * Partner ID
   */
  @IsString()
  @IsOptional()
  partnerId?: string;

  /**
   * Sub-partner code (for aggregator cases)
   */
  @IsString()
  @IsOptional()
  subPartnerCode?: string;

  /**
   * Sub-partner ID (for aggregator cases)
   */
  @IsString()
  @IsOptional()
  subPartnerId?: string;

  /**
   * Current status of the order
   */
  @IsString()
  @IsNotEmpty()
  orderStatus: string;

  /**
   * Type of the order (e.g., ECOMM)
   */
  @IsString()
  @IsNotEmpty()
  type: string;

  /**
   * Service type for the order
   */
  @IsString()
  @IsNotEmpty()
  serviceType: string;

  /**
   * Travel type for the order (e.g., Surface)
   */
  @IsString()
  @IsNotEmpty()
  travelType: string;

  /**
   * Child shipment AWB numbers (if any)
   */
  @IsArray()
  @IsString({ each: true })
  childShipments: string[];

  /**
   * Pickup address information
   */
  @Type(() => AddressDto)
  @ValidateNested()
  @IsNotEmpty()
  pickupAddress: AddressDto;

  /**
   * Shipping/delivery address information
   */
  @Type(() => AddressDto)
  @ValidateNested()
  @IsNotEmpty()
  shippingAddress: AddressDto;

  /**
   * First mile hub information
   */
  @Type(() => AddressDto)
  @ValidateNested()
  @IsOptional()
  firstMileHub?: AddressDto;

  /**
   * Date when the order was created
   */
  @IsDateString()
  @IsNotEmpty()
  orderCreatedDate: string;

  /**
   * Delivery promise details
   */
  @Type(() => DeliveryPromiseDto)
  @ValidateNested()
  @IsNotEmpty()
  deliveryPromise: DeliveryPromiseDto;

  /**
   * Payment details for the order
   */
  @Type(() => PaymentDetailsDto)
  @ValidateNested()
  @IsNotEmpty()
  paymentDetails: PaymentDetailsDto;

  /**
   * Type of shipping (e.g., FORWARD)
   */
  @IsString()
  @IsNotEmpty()
  shippingType: string;

  /**
   * Package dimensions
   */
  @Type(() => DimensionsDto)
  @ValidateNested()
  @IsOptional()
  dimensions?: DimensionsDto;

  /**
   * Whether the order is returnable
   */
  @IsBoolean()
  @IsOptional()
  returnableOrder?: boolean;

  /**
   * Return address information
   */
  @Type(() => AddressDto)
  @ValidateNested()
  @IsOptional()
  returnAddress?: AddressDto;

  /**
   * Delivery mode (e.g., DOX)
   */
  @IsString()
  @IsOptional()
  deliveryMode?: string;

  /**
   * Expected delivery date
   */
  @IsDateString()
  @IsOptional()
  expectedDeliveryBy?: string;

  /**
   * EwayBill numbers
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ewayBillNos?: string[];

  /**
   * Value of the order
   */
  @IsNumber()
  @IsOptional()
  value: number;

  /**
   * Content of the order
   */
  @IsString()
  @IsOptional()
  content: string;

  /**
   * Charges of the order
   */
  @IsNumber()
  @IsOptional()
  charges: number;

  /**
   * Documents of the order
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  documents?: string[];

  /**
   * Bill remarks of the order
   */
  @IsString()
  @IsOptional()
  bill_remarks?: string;
}

export class DocumentDto {
  @IsNumber()
  id: number;

  @IsNumber()
  orderId: number;

  @IsString()
  type: string;

  @IsString()
  number: string;

  @IsString()
  url: string;
}

export class TaxDto {
  @IsNumber()
  id: number;

  @IsNumber()
  orderId: number;

  @IsNumber()
  itemId: number;

  @IsNumber()
  breakdownId: number;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  type: string;

  @IsString()
  value: string;

  @IsString()
  chargedAmount: string;
}

export class DiscountDto {
  @IsNumber()
  id: number;

  @IsNumber()
  orderId: number;

  @IsNumber()
  itemId: number;

  @IsNumber()
  breakdownId: number;

  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsString()
  value: string;

  @IsString()
  description: string;

  @IsString()
  chargedAmount: string;
}

export class ItemDto {
  @IsNumber()
  id: number;

  @IsNumber()
  shipmentId: number;

  @IsString()
  name: string;

  @IsNumber()
  quantity: number;

  @IsString()
  weight: string;

  @IsString()
  unitPrice: string;

  @IsString()
  sku: string;

  @IsString()
  hsnCode: string;

  @IsOptional()
  dimensions?: any; // Could be further typed if needed

  @IsString()
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxDto)
  taxes: TaxDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountDto)
  discounts: DiscountDto[];
}

export class DimensionsV2Dto {
  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsNumber()
  length: number;
}

export class ParentShipmentDto {
  @IsNumber()
  id: number;

  @IsNumber()
  orderId: number;

  @IsString()
  awbNumber: string;

  @ValidateNested()
  @Type(() => DimensionsV2Dto)
  dimensions: DimensionsV2Dto;

  @IsString()
  physicalWeight: string;

  @IsString()
  volumetricWeight: string;

  @IsString()
  note: string;

  @IsOptional()
  specialService?: any;

  @IsOptional()
  packaging?: any;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];
}

export class OtherChargeDto {
  @IsNumber()
  id: number;

  @IsNumber()
  breakdownId: number;

  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsString()
  value: string;

  @IsString()
  description: string;

  @IsString()
  chargedAmount: string;
}

export class BreakdownDto {
  @IsNumber()
  id: number;

  @IsNumber()
  paymentId: number;

  @IsString()
  subTotal: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxDto)
  taxes: TaxDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountDto)
  discounts: DiscountDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OtherChargeDto)
  otherCharges: OtherChargeDto[];
}

export class PaymentDto {
  @IsNumber()
  id: number;

  @IsNumber()
  orderId: number;

  @IsString()
  finalAmount: string;

  @IsString()
  type: string;

  @IsString()
  status: string;

  @IsString()
  currency: string;

  @IsString()
  paymentMethod: string;

  @IsString()
  transactionId: string;

  @ValidateNested()
  @Type(() => BreakdownDto)
  breakdown: BreakdownDto;

  @IsArray()
  splitPayments: any[]; // Could be further typed if needed
}

export class WorkflowContextDto {
  @IsString()
  userId: string;

  @IsString()
  apiVersion: string;

  @IsString()
  source: string;
}

export class AddressV2Dto {
  @IsNumber()
  id: number;

  @IsNumber()
  orderId: number;

  @IsString()
  type: string;

  @IsString()
  zip: string;

  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  email: string;

  @IsString()
  street: string;

  @IsString()
  landmark: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  country: string;
  @IsString()
  @IsOptional()
  countryCode?: string;

  @IsString()
  latitude: string;

  @IsString()
  longitude: string;

  @IsString()
  addressName: string;
}

export class OrderDtov2 {
  @IsString()
  orderId: string;

  @IsString()
  referenceId: string;

  @IsString()
  parcelCategory: string;

  @IsDateString()
  orderDate: string;

  @IsDateString()
  expectedDeliveryDate: string;

  @IsString()
  orderType: string;

  @IsArray()
  @IsString({ each: true })
  eWaybills: string[];

  @IsBoolean()
  autoManifest: boolean;

  @IsBoolean()
  returnable: boolean;

  @IsString()
  deliveryMode: string;

  @IsString()
  serviceType: string;

  @IsString()
  orderStatus: string;

  @IsArray()
  taxes: any[]; // Could be further typed if needed

  @IsArray()
  discounts: any[]; // Could be further typed if needed

  @ValidateNested()
  @Type(() => MetadataDto)
  metadata: MetadataDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressV2Dto)
  addresses: AddressV2Dto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents: DocumentDto[];

  @ValidateNested()
  @Type(() => ParentShipmentDto)
  parentShipment: ParentShipmentDto;

  @IsArray()
  childShipments: any[]; // Could be further typed if needed

  @IsArray()
  vehicles: any[]; // Could be further typed if needed

  @IsArray()
  slots: any[]; // Could be further typed if needed

  @ValidateNested()
  @Type(() => PaymentDto)
  payment: PaymentDto;

  @IsString()
  awbNumber: string;

  @IsString()
  partnerCode: string;

  @IsString()
  workflowId: string;

  @IsString()
  operation: string;

  @ValidateNested()
  @Type(() => WorkflowContextDto)
  workflowContext: WorkflowContextDto;
}
export class BaseOrderReqDto extends BaseReqDto {
  @IsOptional()
  /**
   * Smile AWB number (if applicable)
   */
  @IsString()
  @IsOptional()
  smileAwbNumber?: string;

  @IsEnum(ORDER_TYPE_ENUM, { message: "Invalid order type" })
  type?: ORDER_TYPE_ENUM;

  @IsOptional()
  @IsString({ message: "cAwbNumber must be a string" })
  cAwbNumber?: string;

  @IsNotEmpty({ message: "Order status is required" })
  @IsEnum(ORDER_STATUS_ENUM, { message: "Invalid order status" })
  orderStatus: ORDER_STATUS_ENUM;

  @IsNotEmpty({ message: "Pickup details are required" })
  @ValidateNested()
  @Type(() => AddressDto)
  pickupAddress: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SellerInfoDto)
  sellerInfo?: SellerInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  fmHubAddress?: AddressDto;

  @IsNotEmpty({ message: "Delivery details are required" })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @IsNotEmpty({ message: "Payment details are required" })
  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  paymentDetails: PaymentDetailsDto;

  @IsNotEmpty({ message: "Dimensions are required" })
  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions: DimensionsDto;

  @IsNotEmpty({ message: "Delivery promise is required" })
  @ValidateNested()
  @Type(() => DeliveryPromiseDto)
  deliveryPromise: DeliveryPromiseDto;

  @IsOptional()
  shippingType?: string;

  @IsOptional()
  returnableOrder?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  returnAddress?: AddressDto;

  @IsOptional()
  serviceType?: string;

  @IsOptional()
  travelType?: string;

  @IsOptional()
  childShipments?: string[];

  @IsOptional()
  @IsDateString()
  orderCreatedDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ewayBillNos?: string[];

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  deliveryMode?: string;
}

export class BaseResDto {
  statusCode: number;
  message: string;
  partnerCode?: string;
  data?: any;
  trace?: any;
}

export class BaseOrderResDto extends BaseResDto {
  trackingId?: string;
  referenceNumber?: string;
}

export class BaseCancelOrderDto {
  @IsString()
  @IsNotEmpty()
  cancelReason: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ message: "C-AWB numbers are required" })
  cAwbNumbers: string[];

  @IsOptional()
  @IsString()
  partnerCode?: string;
}

export class DeliveryDetailsDto {
  name: string;
  address: string;
  pincode: string;
  phoneNo: string;
  email: string | null;
}

export class DRSPayloadInnerDto {
  cAWB_No: string;
  deliveryDetails: DeliveryDetailsDto;
  deliveryTypeOptions: string;
  paymentType: string;
  deadWeight: number | null;
  length: number;
  width: number;
  height: number;
}

export class ServiceTypeDto {
  name: string;
  isVisible: boolean;
  icon: string;
}

export class DRSPayloadDTO {
  cAWB_No: string;
  AWB_No: string;
  created_at: string;
  payload: DRSPayloadInnerDto;
  shipmentType: string;
  shippingType: string;
  shipmentStatus: string;
  source: string;
  serviceType: ServiceTypeDto;
}

/**
 * Standardized Network Partner Response DTO
 * All network partner responses will be transformed to this format
 */
export class NetworkPartnerResponseDto {
  /**
   * Whether the API request was successful
   */
  success: boolean;

  /**
   * Status code from the network partner
   */
  statusCode: number;

  /**
   * Message from the network partner
   */
  message: string;

  /**
   * Error details if any
   */
  error?: any;

  /**
   * Reference ID from the network partner
   */
  referenceId?: string;

  /**
   * Authentication token if applicable
   */
  token?: string;

  /**
   * Network partner code
   */
  partnerCode: string;

  /**
   * Response data from the network partner
   */
  data?: any;

  /**
   * Raw response from the network partner for debugging
   */
  rawResponse?: any;

  /**
   * Timestamp of the response
   */
  timestamp: string;
}

/**
 * DTO for manifest creation requests
 * Extends the base request DTO with support for multiple AWB numbers
 * Used primarily for batch manifest operations with delivery partners
 */
export class ManifestReqDto {
  /**
   * List of AWB numbers to include in the manifest
   */
  @IsArray()
  @IsString({ each: true })
  awbNumbers: string[];

  @IsOptional()
  @IsString({ message: "Partner code must be a string" })
  partnerCode?: string;
}

/**
 * Utility to extract all items from parentShipment and childShipments into a flat lineItems array
 * Usage: const lineItems = extractLineItems(data)
 */
export function extractLineItems(data: any): any[] {
  const extract = (item: any) => ({
    name: item.name,
    quantity: item.quantity,
    weight: item.weight,
    unitPrice: item.unitPrice,
    sku: item.sku,
    hsnCode: item.hsnCode,
    dimensions: item.dimensions,
    description: item.description,
    taxes: item.taxes,
    discounts: item.discounts,
  });
  const parentItems = (data.parentShipment?.items || []).map(extract);
  const childItems = (data.childShipments || []).flatMap((cs: any) => (cs.items || []).map(extract));
  return [...parentItems, ...childItems];
}

export class BaseOrderReqDtoV2 extends BaseReqDto {
  @IsString()
  orderId: string;

  @IsString()
  referenceId: string;

  @IsString()
  parcelCategory: string;

  @IsDateString()
  orderDate: string;

  @IsDateString()
  expectedDeliveryDate: string;

  @IsString()
  orderType: string;

  @IsArray()
  @IsString({ each: true })
  eWaybills: string[];

  @IsBoolean()
  autoManifest: boolean;

  @IsBoolean()
  returnable: boolean;

  @IsString()
  deliveryMode: string;

  @IsString()
  serviceType: string;

  @IsString()
  orderStatus: string;

  @IsArray()
  taxes: any[];

  @IsArray()
  discounts: any[];

  @ValidateNested()
  @Type(() => MetadataDto)
  metadata: MetadataDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressV2Dto)
  addresses: AddressV2Dto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents: DocumentDto[];

  @ValidateNested()
  @Type(() => ParentShipmentDto)
  parentShipment: ParentShipmentDto;

  @IsArray()
  childShipments: any[];

  @IsArray()
  vehicles: any[];

  @IsArray()
  slots: any[];

  @ValidateNested()
  @Type(() => PaymentDto)
  payment: PaymentDto;

  @IsString()
  awbNumber: string;

  @IsString()
  partnerCode: string;

  @IsString()
  workflowId: string;

  @IsString()
  operation: string;

  @ValidateNested()
  @Type(() => WorkflowContextDto)
  workflowContext: WorkflowContextDto;
}
