import { Type } from "class-transformer";
import { ORDER_STATUS_ENUM, ORDER_TYPE_ENUM } from "../enums/global.enum";
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  ValidateNested,
  IsOptional,
  IsDateString,
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
  data?: any;
  trace?: any;
}
export class AddressDto {
  pincode: string;
  name: string;
  mobile: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  latitude?: number;
  longitude?: number;
}

export class DeliveryPromiseDto {
  shortCode: string;
}

export class PaymentDetailsDto {
  amount: number;
  isCOD: boolean;
}

export class DimensionsDto {
  weight: number;
  length: number;
  width: number;
  height: number;
  breadth?: number;
}

export class BaseOrderReqDto extends BaseReqDto {
  // @IsNotEmpty({ message: 'Order type is required' })
  // @IsEnum(ORDER_TYPE_ENUM, { message: 'Invalid order type' })
  type?: ORDER_TYPE_ENUM;

  @IsNotEmpty({ message: "Order status is required" })
  @IsEnum(ORDER_STATUS_ENUM, { message: "Invalid order status" })
  orderStatus: ORDER_STATUS_ENUM;

  @IsNotEmpty({ message: "Pickup details are required" })
  @ValidateNested()
  @Type(() => AddressDto)
  pickupAddress: AddressDto;

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

  // @IsNotEmpty({ message: 'Shipping type is required' })
  // @IsEnum(SHIPPING_TYPE_ENUM, { message: 'Invalid shipping type' })
  shippingType?: string;

  // @IsNotEmpty({ message: 'Returnable order is required' })
  returnableOrder?: boolean;

  // @IsNotEmpty({ message: 'Return address is required' })
  // @ValidateNested()
  // @Type(() => AddressDto)
  returnAddress?: AddressDto;

  // @IsNotEmpty({ message: 'Delivery mode is required' })
  // @IsEnum(DELIVERY_MODE_ENUM, { message: 'Invalid delivery mode' })
  deliveryMode?: string;

  // @IsNotEmpty({ message: 'Service type is required' })
  // @IsEnum(SERVICE_TYPE_ENUM, { message: 'Invalid service type' })
  serviceType?: string;

  // @IsNotEmpty({ message: 'Travel type is required' })
  // @IsEnum(TRAVEL_TYPE_ENUM, { message: 'Invalid travel type' })
  travelType?: string;

  // @IsNotEmpty({ message: 'Child shipments are required' })
  childShipments?: string[];

  // carrierName?: string;

  // @IsOptional()
  // @IsDateString()
  orderCreatedDate?: string;

  // Aliases for compatibility with the payload
  // @ValidateNested()
  // @Type(() => AddressDto)
  // get pickupAddress(): AddressDto {
  //     return this.pickupDetails;
  // }

  // set pickupAddress(address: AddressDto) {
  //     this.pickupDetails = address;
  // }

  // @ValidateNested()
  // @Type(() => AddressDto)
  // get shippingAddress(): AddressDto {
  //     return this.deliveryDetails;
  // }

  // set shippingAddress(address: AddressDto) {
  //     this.deliveryDetails = address;
  // }
}

export class BaseOrderResDto extends BaseResDto {
  trackingId?: string;
  referenceNumber?: string;
}

export class BaseCancelOrderDto extends BaseReqDto {
  //   @IsString()
  //   @IsNotEmpty()
  cancelReason: string;
}
