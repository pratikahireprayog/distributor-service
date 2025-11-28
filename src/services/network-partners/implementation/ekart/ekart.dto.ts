import { 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsNumber, 
  IsArray, 
  ValidateNested, 
  IsBoolean,
  IsDateString
} from "class-validator";
import { Type } from "class-transformer";

// Authentication DTOs (for EkartAuthService compatibility)
export class EkartAuthRequestDto {
  userName: string;
  password: string;
}

export class EkartAuthResponseDto {
  data?: string; // Token is in data field
  status?: boolean;
  message?: string;
}

// Legacy DTOs (for backward compatibility)
export class EkartCreateOrderRequestDto {
  poNumber: string;
  travelMode: string; // "Road" | "Air"
  grossWeight: number;
  packetCount: number;
  material?: string | null;
  lbhData: EkartLbhDataDto[];
  invoiceDetails: EkartInvoiceDetailsDto[];
  consignor: EkartConsignorDto;
  consignee: EkartConsigneeDto;
  docketNo?: string | null;
  packetLbhUom: string; // "in" | "cm"
  totalConsignmentValue: number;
  ftlOrPtl: string; // "1" | "0"
  openBoxPickup: number; // 0 | 1
  truckType?: string | null; // "20FT" | null
  deliveryAppointmentDate?: string; // DD-MM-YYYY format
  deliveryTimeSlot?: string; // e.g., "16-20"
  deliveryType?: number; // e.g., 1
}

export class EkartCreateOrderResponseDto {
  status?: boolean;
  message?: string;
  data?: {
    pickupPincode?: number;
    poNumber?: string;
    docketNo?: number;
    pickupRegistrationId?: number;
    docketPdfLink?: string;
    labelsLink?: string;
    startPktNo?: number;
    endPktNo?: number;
    awbNumber?: string;
    orderId?: string;
    trackingNumber?: string;
  };
  statusCode?: number;
  orderId?: string;
  trackingNumber?: string;
  awbNumber?: string;
  docketNo?: string;
}

export class EkartCancelOrderRequestDto {
  remarks: string; // Hardcoded: "destination changed"
  reason: string; // Hardcoded: "CC"
  docketList: number[]; // Array of docket numbers
}

export class EkartCancelOrderResponseDto {
  status?: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}

/**
 * DTO for Cargodham Address
 */
export class CargodhamAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address1: string;

  @IsString()
  @IsOptional()
  address2?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  zip: string;

  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsBoolean()
  @IsOptional()
  isPickupAddress?: boolean;

  @IsBoolean()
  @IsOptional()
  isShippingAddress?: boolean;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  vendorCode?: string;

  @IsString()
  @IsOptional()
  gstNumber?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

/**
 * DTO for Cargodham Line Item
 */
export class CargodhamLineItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  weight: number;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @IsNotEmpty()
  unitPrice: number;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber()
  @IsNotEmpty()
  height: number;

  @IsNumber()
  @IsNotEmpty()
  width: number;

  @IsNumber()
  @IsNotEmpty()
  length: number;
}

/**
 * DTO for Cargodham E-waybill
 */
export class CargodhamEwayBillDto {
  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsOptional()
  validUpto?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  startDate?: string;
}

/**
 * DTO for Cargodham Invoice
 */
export class CargodhamInvoiceDto {
  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  value?: string;
}

/**
 * DTO for Cargodham Charges Data
 */
export class CargodhamChargesDataDto {
  @IsString()
  @IsOptional()
  risk_type_charge?: string;

  @IsString()
  @IsOptional()
  fuelChargeAmount?: string;

  @IsString()
  @IsOptional()
  docketCharge?: string;

  @IsString()
  @IsOptional()
  platformFee?: string;

  @IsNumber()
  @IsOptional()
  freight_charge?: number;

  @IsNumber()
  @IsOptional()
  minimumFreight?: number;

  @IsNumber()
  @IsOptional()
  courier_charge?: number;
}

/**
 * DTO for Cargodham Metadata
 */
export class CargodhamMetadataDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

/**
 * DTO for Cargodham Order Request
 * This represents the request coming from Cargodham API
 */
export class CargodhamOrderReqDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  orderNumber: string;

  @IsString()
  @IsNotEmpty()
  awbNumber: string;

  @IsDateString()
  @IsNotEmpty()
  orderCreatedAt: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsNumber()
  @IsNotEmpty()
  weight: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CargodhamLineItemDto)
  lineItems: CargodhamLineItemDto[];

  @IsString()
  @IsNotEmpty()
  paymentType: string;

  @IsString()
  @IsNotEmpty()
  paymentStatus: string;

  @IsBoolean()
  @IsOptional()
  returnableOrder?: boolean;

  @ValidateNested()
  @Type(() => CargodhamAddressDto)
  shippingAddress: CargodhamAddressDto;

  @ValidateNested()
  @Type(() => CargodhamAddressDto)
  billingAddress: CargodhamAddressDto;

  @ValidateNested()
  @Type(() => CargodhamAddressDto)
  pickupAddress: CargodhamAddressDto;

  @ValidateNested()
  @Type(() => CargodhamAddressDto)
  @IsOptional()
  returnAddress?: CargodhamAddressDto;

  @IsNumber()
  @IsNotEmpty()
  invoiceValue: number;

  @IsNumber()
  @IsOptional()
  length?: number;

  @IsNumber()
  @IsOptional()
  height?: number;

  @IsNumber()
  @IsOptional()
  width?: number;

  @IsString()
  @IsNotEmpty()
  deliveryMode: string;

  @IsNumber()
  @IsOptional()
  gstPercentage?: number;

  @IsString()
  @IsNotEmpty()
  channelType: string;

  @IsString()
  @IsNotEmpty()
  orderSubtype: string;

  @IsString()
  @IsOptional()
  subCarrierName?: string;

  @IsString()
  @IsOptional()
  subCarrierId?: string;

  @IsNumber()
  @IsOptional()
  cargoDeliveryAmount?: number;

  @IsString()
  @IsOptional()
  cargoInvoiceNumber?: string;

  @IsString()
  @IsOptional()
  cargoInvoiceUrl?: string;

  @IsNumber()
  @IsOptional()
  cargoSellerPercentageAmount?: number;

  @IsBoolean()
  @IsOptional()
  isParentOrder?: boolean;

  @IsOptional()
  cargoBoxDetails?: any;

  @IsString()
  @IsNotEmpty()
  carrierName: string;

  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  ewaybillUrl?: string;

  @IsString()
  @IsOptional()
  ewaybillNumber?: string;

  @IsString()
  @IsOptional()
  ewayExpiryDate?: string;

  @IsString()
  @IsOptional()
  appointmentDate?: string;

  @IsNumber()
  @IsOptional()
  chargebleWeight?: number;

  @IsNumber()
  @IsOptional()
  gst?: number;

  @IsNumber()
  @IsOptional()
  igst?: number;

  @IsNumber()
  @IsOptional()
  sgst?: number;

  @IsNumber()
  @IsOptional()
  cgst?: number;

  @IsNumber()
  @IsOptional()
  volumetricWeight?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CargodhamEwayBillDto)
  @IsOptional()
  ewayBills?: CargodhamEwayBillDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ewayUrls?: string[];

  @IsOptional()
  cargoEwayExpiryDates?: Record<string, string>;

  @IsOptional()
  cargoInvoiceNumbers?: any;

  @IsOptional()
  cargoInvoiceUrls?: any;

  @IsNumber()
  @IsOptional()
  tat?: number;

  @ValidateNested()
  @Type(() => CargodhamChargesDataDto)
  @IsOptional()
  chargesData?: CargodhamChargesDataDto;

  @IsString()
  @IsOptional()
  orderCreatedFrom?: string;

  @IsString()
  @IsOptional()
  vendorCode?: string;

  @IsString()
  @IsOptional()
  carrierId?: string;

  @IsString()
  @IsOptional()
  transporterId?: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CargodhamMetadataDto)
  @IsOptional()
  metadata?: CargodhamMetadataDto[];

  @IsString()
  @IsOptional()
  subType?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CargodhamInvoiceDto)
  @IsOptional()
  cargoInvoices?: CargodhamInvoiceDto[];
}

/**
 * DTO for Ekart LBH (Length, Breadth, Height) Data
 */
export class EkartLbhDataDto {
  @IsNumber()
  @IsNotEmpty()
  packetCount: number;

  @IsString()
  @IsNotEmpty()
  packetLength: string;

  @IsString()
  @IsNotEmpty()
  packetWidth: string;

  @IsString()
  @IsNotEmpty()
  packetHeight: string;

  @IsOptional()
  packetNo: string | null;

  @IsString()
  @IsNotEmpty()
  customerPacketRefNo: string;

  @IsString()
  @IsNotEmpty()
  actualWeight: string;

  @IsOptional()
  invoiceNo: string | null;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

/**
 * DTO for Ekart Invoice Details
 */
export class EkartInvoiceDetailsDto {
  @IsString()
  @IsNotEmpty()
  invoiceNo: string;

  @IsNumber()
  @IsNotEmpty()
  invoiceAmount: number;

  @IsOptional()
  ewbNo: string | null;

  @IsString()
  @IsNotEmpty()
  invoiceDate: string;

  @IsOptional()
  ewbDate: string | null;

  @IsOptional()
  ewbValidTill: string | null;
}

/**
 * DTO for Ekart Consignor/Consignee
 */
export class EkartConsignorDto {
  @IsString()
  @IsNotEmpty()
  consignorCode: string;

  @IsString()
  @IsNotEmpty()
  consignorPincode: string;

  @IsString()
  @IsNotEmpty()
  consignorName: string;

  @IsString()
  @IsNotEmpty()
  address1: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsString()
  @IsNotEmpty()
  contactPhoneno: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class EkartConsigneeDto {
  @IsString()
  @IsNotEmpty()
  consigneeCode: string;

  @IsString()
  @IsNotEmpty()
  consigneePincode: string;

  @IsString()
  @IsNotEmpty()
  consigneeName: string;

  @IsString()
  @IsNotEmpty()
  address1: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsString()
  @IsNotEmpty()
  contactPhoneno: string;

  @IsString()
  @IsOptional()
  email?: string;
}

/**
 * DTO for Ekart Create Order Request
 * This represents the payload sent to Ekart API
 */
export class EkartCreateOrderReqDto {
  @IsString()
  @IsNotEmpty()
  poNumber: string;

  @IsString()
  @IsNotEmpty()
  travelMode: string; // "Air" or "Road"

  @IsNumber()
  @IsNotEmpty()
  grossWeight: number;

  @IsNumber()
  @IsNotEmpty()
  packetCount: number;

  @IsString()
  @IsOptional()
  material?: string | null;

  @IsString()
  @IsOptional()
  deliveryAppointmentDate?: string | null;

  @IsString()
  @IsOptional()
  deliveryTimeSlot?: string | null;

  @IsNumber()
  @IsNotEmpty()
  deliveryType: number; // 0 for AWD, 1 for AD

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EkartLbhDataDto)
  lbhData: EkartLbhDataDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EkartInvoiceDetailsDto)
  invoiceDetails: EkartInvoiceDetailsDto[];

  @ValidateNested()
  @Type(() => EkartConsignorDto)
  consignor: EkartConsignorDto;

  @ValidateNested()
  @Type(() => EkartConsigneeDto)
  consignee: EkartConsigneeDto;

  @IsOptional()
  docketNo: string | null;

  @IsString()
  @IsNotEmpty()
  packetLbhUom: string; // "in" for inches

  @IsNumber()
  @IsNotEmpty()
  totalConsignmentValue: number;

  @IsString()
  @IsNotEmpty()
  ftlOrPtl: string; // "0" for PTL, "1" for FTL

  @IsNumber()
  @IsNotEmpty()
  openBoxPickup: number; // 0 for normal pickup

  @IsString()
  @IsOptional()
  truckType?: string | null; // Only required if ftlOrPtl is "1"
}

/**
 * DTO for Ekart Create Order Response
 */
export class EkartCreateOrderResDto {
  @IsBoolean()
  status: boolean;

  @IsString()
  message: string;

  @IsOptional()
  data?: {
    docketNo?: string;
    labelsLink?: string;
    [key: string]: any;
  };
}

/**
 * DTO for Ekart Login Request
 */
export class EkartLoginReqDto {
  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  password: string; // Should be RSA encrypted
}

/**
 * DTO for Ekart Login Response
 */
export class EkartLoginResDto {
  @IsBoolean()
  status: boolean;

  @IsString()
  message: string;

  @IsString()
  data: string; // JWT token
}

/**
 * DTO for Ekart Cancel Order Request
 */
export class EkartCancelOrderReqDto {
  @IsString()
  @IsOptional()
  remarks?: string;

  @IsString()
  @IsNotEmpty()
  reason: string; // Cancel reason code

  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  docketList: number[]; // Array of docket numbers
}

/**
 * DTO for Ekart Cancel Order Response
 */
export class EkartCancelOrderResDto {
  @IsBoolean()
  status: boolean;

  @IsString()
  message: string;

  @IsOptional()
  data?: Array<{
    docketNo: string;
    flag: boolean;
    message: string;
  }>;
}
