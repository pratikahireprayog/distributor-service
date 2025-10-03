import { IsString, IsNumber, IsOptional, IsEmail, IsDateString } from 'class-validator';

export class UrbanBoltAuthRequestDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class UrbanBoltAuthResponseDto {
  @IsString()
  access_token: string;

  @IsNumber()
  expires_in: number;

  @IsString()
  token_type: string;

  @IsString()
  expires: string;

  @IsString()
  status: string;
}

export class UrbanBoltManifestRequestDto {
  @IsString()
  customerCode: string;

  @IsString()
  orderNumber: string;

  @IsString()
  payMode: string; // PPD, COD

  @IsString()
  serviceType: string; // SDD, NDD

  @IsNumber()
  collectableValue: number;

  @IsNumber()
  declaredValue: number;

  @IsString()
  itemDescription: string;

  @IsNumber()
  pieces: number;

  @IsNumber()
  weight: number;

  @IsNumber()
  length: number;

  @IsNumber()
  breadth: number;

  @IsNumber()
  height: number;

  @IsNumber()
  volWeight: number;

  @IsDateString()
  invoiceDate: string;

  @IsString()
  invoiceNumber: string;

  @IsNumber()
  invoiceValue: number;

  @IsNumber()
  itemQuantity: number;

  @IsString()
  itemSku: string;

  @IsString()
  itemHsn: string;

  // Consignee Details
  @IsString()
  consName: string;

  @IsString()
  consAddress: string;

  @IsString()
  consCity: string;

  @IsString()
  consState: string;

  @IsString()
  consCountry: string;

  @IsString()
  consPincode: string;

  @IsString()
  consMobile: string;

  @IsEmail()
  consEmail: string;

  @IsNumber()
  @IsOptional()
  consLat?: number;

  @IsNumber()
  @IsOptional()
  consLng?: number;

  @IsString()
  consAddressType: string;

  // Shipper Details
  @IsString()
  shprId: string;

  @IsString()
  shprName: string;

  @IsString()
  shprAddress: string;

  @IsString()
  shprCity: string;

  @IsString()
  shprState: string;

  @IsString()
  shprCountry: string;

  @IsString()
  shprPincode: string;

  @IsString()
  shprMobile: string;

  @IsEmail()
  shprEmail: string;

  @IsString()
  shprAddressType: string;

  @IsNumber()
  @IsOptional()
  shprLat?: number;

  @IsNumber()
  @IsOptional()
  shprLng?: number;

  // Return Details
  @IsString()
  rtnId: string;

  @IsString()
  rtnName: string;

  @IsString()
  rtnAddress: string;

  @IsString()
  rtnCity: string;

  @IsString()
  rtnState: string;

  @IsString()
  rtnCountry: string;

  @IsString()
  rtnPincode: string;

  @IsString()
  rtnMobile: string;

  @IsEmail()
  rtnEmail: string;
}

export class UrbanBoltManifestResponseDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsOptional()
  successResponse?: UrbanBoltSuccessResponseDto[];

  @IsOptional()
  errorResponse?: UrbanBoltErrorResponseDto[];
}

export class UrbanBoltSuccessResponseDto {
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsString()
  @IsOptional()
  customerCode?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  trackingId?: string;

  @IsString()
  @IsOptional()
  awbNumber?: string;

  @IsOptional()
  data?: any;
}

export class UrbanBoltErrorResponseDto {
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsString()
  @IsOptional()
  customerCode?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsOptional()
  details?: any;
}
