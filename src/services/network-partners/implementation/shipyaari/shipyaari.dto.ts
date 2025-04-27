import { IsNotEmpty, IsOptional, IsString, IsEmail } from "class-validator";
import { SHIPYAARI_PAYMENT_TYPE } from "./shipyaari.enum";

/**
 * DTO for Shipyaari authentication request
 */
export class ShipyaariAuthReqDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  client_id?: string;
}

/**
 * DTO for Shipyaari authentication response
 */
export class ShipyaariAuthResDto {
  success: boolean;
  statusCode: number;
  message: string;
  data: Array<{
    token: string;
    jwt: string;
    sellerId: number;
    companyId: string;
    // Other fields exist but we only care about the token
  }>;
}

/**
 * DTO for Shipyaari order pickup address
 */
export class ShipyaariPickupAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  company_name: string;

  @IsString()
  @IsNotEmpty()
  address_line1: string;

  @IsString()
  @IsOptional()
  address_line2?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  pincode: string;

  @IsString()
  @IsOptional()
  email?: string;
}

/**
 * DTO for Shipyaari order delivery address
 */
export class ShipyaariDeliveryAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address_line1: string;

  @IsString()
  @IsOptional()
  address_line2?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  pincode: string;

  @IsString()
  @IsOptional()
  email?: string;
}

/**
 * DTO for Shipyaari order request
 */
export class ShipyaariOrderReqDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  service_type: string;

  @IsString()
  @IsNotEmpty()
  service_code: string;

  @IsString()
  @IsNotEmpty()
  payment_mode: SHIPYAARI_PAYMENT_TYPE;

  @IsString()
  @IsNotEmpty()
  order_id: string;

  @IsString()
  @IsNotEmpty()
  total_amount: string; // Numeric value as string

  @IsString()
  @IsNotEmpty()
  COD_amount: string; // Numeric value as string

  @IsString()
  @IsNotEmpty()
  weight: string; // Weight in KG as string

  @IsString()
  @IsOptional()
  length?: string; // Length in CM as string

  @IsString()
  @IsOptional()
  width?: string; // Width in CM as string

  @IsString()
  @IsOptional()
  height?: string; // Height in CM as string

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNotEmpty()
  pickup_address: ShipyaariPickupAddressDto;

  @IsNotEmpty()
  delivery_address: ShipyaariDeliveryAddressDto;
}

/**
 * DTO for Shipyaari order response
 */
export class ShipyaariOrderResDto {
  tracking_number: string;
  awb_number: string;
  reference_number: string;
  status: boolean;
  message: string;
}

/**
 * DTO for Shipyaari manifest request
 */
export class ShipyaariManifestReqDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  awb_numbers: string; // Comma-separated AWB numbers
}

/**
 * DTO for Shipyaari manifest response
 */
export class ShipyaariManifestResDto {
  manifest_url: string;
  status: boolean;
  message: string;
}

/**
 * DTO for Shipyaari cancel order request
 */
export class ShipyaariCancelOrderReqDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  awb: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * DTO for Shipyaari cancel order response
 */
export class ShipyaariCancelOrderResDto {
  status: boolean;
  message: string;
}
