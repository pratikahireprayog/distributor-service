import { IsNotEmpty, IsString, IsArray, IsOptional, ValidateNested, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class DHLPickupAddressDto {
  @IsNotEmpty()
  @IsString()
  postalCode: string;

  @IsNotEmpty()
  @IsString()
  cityName: string;

  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @IsNotEmpty()
  @IsString()
  addressLine1: string;
}

export class DHLPickupContactDto {
  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  mobilePhone?: string;

  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;
}

export class DHLPickupShipperDetailsDto {
  @ValidateNested()
  @Type(() => DHLPickupAddressDto)
  postalAddress: DHLPickupAddressDto;

  @ValidateNested()
  @Type(() => DHLPickupContactDto)
  contactInformation: DHLPickupContactDto;
}

export class DHLPickupCustomerDetailsDto {
  @ValidateNested()
  @Type(() => DHLPickupShipperDetailsDto)
  shipperDetails: DHLPickupShipperDetailsDto;
}

export class DHLPickupShipmentDetailsDto {
  @IsNotEmpty()
  @IsString()
  productCode: string;

  @IsNotEmpty()
  @IsString()
  localProductCode: string;

  @IsNotEmpty()
  @IsString()
  unitOfMeasurement: string;
}

export class DHLPickupAccountDto {
  @IsNotEmpty()
  @IsString()
  typeCode: string;

  @IsNotEmpty()
  @IsString()
  number: string;
}

export class DHLCreatePickupDto {
  @IsNotEmpty()
  @IsDateString()
  plannedPickupDateAndTime: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DHLPickupAccountDto)
  accounts: DHLPickupAccountDto[];

  @ValidateNested()
  @Type(() => DHLPickupCustomerDetailsDto)
  customerDetails: DHLPickupCustomerDetailsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DHLPickupShipmentDetailsDto)
  shipmentDetails: DHLPickupShipmentDetailsDto[];
}

export class DHLPickupResponseDto {
  @IsArray()
  @IsString({ each: true })
  dispatchConfirmationNumbers: string[];
}

export class DHLCancelPickupDto {
  @IsNotEmpty()
  @IsString()
  pickupId: string;

  @IsNotEmpty()
  @IsString()
  requestorName: string;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class DHLCancelPickupResponseDto {
  @IsNotEmpty()
  @IsString()
  message: string;
}

