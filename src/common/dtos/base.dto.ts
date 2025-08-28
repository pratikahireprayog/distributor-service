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

export class BaseResDto {
  statusCode: number;
  message: string;
  partnerCode?: string;
  metadata?: {
    transporterId?: string;
    [key: string]: any;
  };
  data?: any;
  trace?: any;
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


  @IsString()
  @IsOptional()
  clientIdSevasetu: string  


  @IsOptional()
  childAwbs:string[]

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


  @IsOptional()
  @IsString()
  clientIdSevasetu: string    

  @IsOptional()
  childAwbs:string[]


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

  /**
   * Value of the shipment
   */
  @IsOptional()
  @IsNumber()
  shipmentValue?: number;

  /**
   * Remarks or description for the shipment
   */
  @IsOptional()
  @IsString()
  remarks?: string;

  /**
   * Source premise ID
   */
  @IsOptional()
  @IsString()
  cpId?: string;
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
