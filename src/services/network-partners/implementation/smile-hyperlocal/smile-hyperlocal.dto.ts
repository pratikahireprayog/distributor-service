import { IsNotEmpty, IsOptional, IsString, IsEmail, IsNumber, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

// Login DTOs
export class SmileHyperlocalLoginReqDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  vendorType?: string = "SELLER";
}

export class SmileHyperlocalLoginResDto {
  success: boolean;
  message: string;
  data: {
    token: string;
    // other fields if needed
  };
}

// Address DTO
export class SmileHyperlocalAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  email?: string;

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
  country: string;

  @IsString()
  @IsNotEmpty()
  zip: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;
}

// Line Item DTO
export class SmileHyperlocalLineItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  weight: number;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @IsNotEmpty()
  unitPrice: number;
}

// Booking DTOs
export class SmileHyperlocalBookingReqDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  orderNumber: string;

  @IsString()
  @IsNotEmpty()
  orderSubtype: string;

  @IsString()
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
  @Type(() => SmileHyperlocalLineItemDto)
  lineItems: SmileHyperlocalLineItemDto[];

  @IsString()
  @IsNotEmpty()
  paymentType: string;

  @IsString()
  @IsNotEmpty()
  paymentStatus: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @ValidateNested()
  @Type(() => SmileHyperlocalAddressDto)
  shippingAddress: SmileHyperlocalAddressDto;

  @ValidateNested()
  @Type(() => SmileHyperlocalAddressDto)
  pickupAddress: SmileHyperlocalAddressDto;

  @IsString()
  @IsOptional()
  deliveryPromise?: string;

  @IsOptional()
  returnableOrder?: boolean;

  @IsString()
  @IsOptional()
  channelCode?: string;

  @IsNumber()
  @IsOptional()
  length?: number;

  @IsNumber()
  @IsOptional()
  height?: number;

  @IsNumber()
  @IsOptional()
  width?: number;
}

export class SmileHyperlocalBookingResDto {
  success: boolean;
  message: string;
  data?: any;
} 