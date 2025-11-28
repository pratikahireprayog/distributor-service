import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

/**
 * Login Request DTO
 */
export class DelhiveryLoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

/**
 * Login Response DTO
 */
export class DelhiveryLoginResDto {
  token?: string;
  message?: string;
}

/**
 * Pincode Service Query DTO
 */
export class DelhiveryPincodeQueryDto {
  @IsString()
  @IsNotEmpty()
  pincode: string;

  @IsNumber()
  @IsOptional()
  weight?: number;
}

/**
 * Dropoff Location DTO
 */
export class DropoffLocationDto {
  @IsString()
  @IsNotEmpty()
  consignee_name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

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
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  email?: string;
}

/**
 * Invoice DTO
 */
export class InvoiceDto {
  @IsString()
  @IsOptional()
  ewaybill?: string;

  @IsString()
  @IsNotEmpty()
  inv_num: string;

  @IsNumber()
  @IsNotEmpty()
  inv_amt: number;

  @IsString()
  @IsOptional()
  inv_qr_code?: string;
}

/**
 * Shipment Detail DTO
 */
export class ShipmentDetailDto {
  @IsString()
  @IsNotEmpty()
  order_id: string;

  @IsNumber()
  @IsNotEmpty()
  box_count: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  weight: number;

  @IsArray()
  @IsOptional()
  waybills?: string[];

  @IsBoolean()
  @IsOptional()
  master?: boolean;
}

/**
 * Document Metadata DTO
 */
export class DocMetaDto {
  @IsArray()
  @IsString({ each: true })
  invoice_num: string[];
}

/**
 * Document Data DTO
 */
export class DocDataDto {
  @IsString()
  @IsNotEmpty()
  doc_type: string;

  @ValidateNested()
  @Type(() => DocMetaDto)
  doc_meta: DocMetaDto;
}

/**
 * Billing Address DTO
 */
export class BillingAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  company: string;

  @IsString()
  @IsNotEmpty()
  consignor: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  pin: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  pan_number?: string;

  @IsString()
  @IsOptional()
  gst_number?: string;
}

/**
 * Create Manifest Request DTO
 */
export class CreateManifestDto {
  @IsString()
  @IsOptional()
  lrn?: string;

  @IsString()
  @IsNotEmpty()
  pickup_location_name: string;

  @IsString()
  @IsNotEmpty()
  payment_mode: string;

  @IsNumber()
  @IsOptional()
  cod_amount?: number;

  @IsNumber()
  @IsNotEmpty()
  weight: number;

  @ValidateNested()
  @Type(() => DropoffLocationDto)
  dropoff_location: DropoffLocationDto;

  @IsBoolean()
  @IsOptional()
  rov_insurance?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceDto)
  invoices: InvoiceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentDetailDto)
  shipment_details: ShipmentDetailDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocDataDto)
  @IsOptional()
  doc_data?: DocDataDto[];

  @IsOptional()
  doc_file?: any;

  @IsBoolean()
  @IsOptional()
  fm_pickup?: boolean;

  @IsString()
  @IsNotEmpty()
  freight_mode: string;

  @ValidateNested()
  @Type(() => BillingAddressDto)
  billing_address: BillingAddressDto;
}

/**
 * Dimension DTO
 */
export class DimensionDto {
  @IsNumber()
  width_cm: number;

  @IsNumber()
  height_cm: number;

  @IsNumber()
  length_cm: number;

  @IsNumber()
  box_count: number;
}

/**
 * Callback DTO
 */
export class CallbackDto {
  @IsString()
  @IsNotEmpty()
  uri: string;

  @IsString()
  @IsNotEmpty()
  method: string;

  @IsString()
  @IsOptional()
  authorization?: string;
}

/**
 * Invoice File Meta DTO
 */
export class InvoiceFileMetaDto {
  @IsArray()
  @IsString({ each: true })
  invoices: string[];
}

/**
 * Update LRN Request DTO
 */
export class UpdateLrnDto {
  @IsString()
  @IsNotEmpty()
  lrn: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceDto)
  @IsOptional()
  invoices?: InvoiceDto[];

  @IsNumber()
  @IsOptional()
  cod_amount?: number;

  @IsString()
  @IsOptional()
  consignee_name?: string;

  @IsString()
  @IsOptional()
  consignee_address?: string;

  @IsString()
  @IsOptional()
  consignee_pincode?: string;

  @IsString()
  @IsOptional()
  consignee_phone?: string;

  @IsNumber()
  @IsOptional()
  weight_g?: number;

  @ValidateNested()
  @Type(() => CallbackDto)
  @IsOptional()
  cb?: CallbackDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DimensionDto)
  @IsOptional()
  dimensions?: DimensionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceFileMetaDto)
  @IsOptional()
  invoice_files_meta?: InvoiceFileMetaDto[];

  @IsOptional()
  invoice_file?: any;
}

/**
 * Cancel LRN Request DTO
 */
export class CancelLrnDto {
  @IsString()
  @IsNotEmpty()
  lrn: string;
}

