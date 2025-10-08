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

// --- Moved from base.dto.ts ---

export class MetadataDto {
  @IsString()
  source: string;

  @IsString()
  createdBy: string;

  @IsString()
  sourcePremiseId: string;

  @IsString()
  destinationPremiseId: string;
}

export class AddressV2Dto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsNumber()
  orderId?: number;

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

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  addressName: string;
}

export class DocumentDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsNumber()
  orderId?: number;

  @IsString()
  type: string;

  @IsString()
  number: string;

  @IsString()
  url: string;
}

export class DimensionsV2Dto {
  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsNumber()
  length: number;
}

export class PackagingDto {
  @IsString()
  type: string;

  @IsArray()
  @IsString({ each: true })
  materials: string[];

  @IsBoolean()
  fragileHandling: boolean;
}

export class ParentShipmentDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsNumber()
  orderId?: number;

  @IsString()
  awbNumber: string;

  @IsString()
  documentType: string;

  @IsString()
  cAwbNumber: string;

  @ValidateNested()
  @Type(() => DimensionsV2Dto)
  dimensions: DimensionsV2Dto;

  @IsNumber()
  physicalWeight: number;

  @IsNumber()
  volumetricWeight: number;

  @IsString()
  note: string;

  @IsArray()
  specialService: any[];

  @ValidateNested()
  @Type(() => PackagingDto)
  packaging: PackagingDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @IsOptional()
  @IsString()
  discount?: string;
}

export class BreakdownDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsNumber()
  paymentId?: number;

  @IsNumber()
  subTotal: number;

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
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsNumber()
  orderId?: number;

  finalAmount: number;

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

// --- Move dependencies for DTOs ---

export class ItemDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsNumber()
  shipmentId?: number;

  @IsOptional()
  @IsString()
  _shipmentType?: string;

  @IsOptional()
  @IsNumber()
  _shipmentIndex?: number;

  @IsString()
  name: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  weight: number;

  @IsNumber()
  unitPrice: number;

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

// --- Move additional dependencies for DTOs ---

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

export class ShipmentDto {
  @IsString()
  awbNumber: string;

  @IsString()
  documentType: string;

  @IsString()
  cAwbNumber: string;

  @IsString()
  smileAwbNumber: string;

  @IsBoolean()
  isParent: boolean;

  @ValidateNested()
  @Type(() => DimensionsV2Dto)
  dimensions: DimensionsV2Dto;

  @IsNumber()
  physicalWeight: number;

  @IsNumber()
  volumetricWeight: number;

  @IsString()
  note: string;

  @IsArray()
  specialService: any[];

  @ValidateNested()
  @Type(() => PackagingDto)
  packaging: PackagingDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @IsOptional()
  @IsString()
  discount?: string;
}

export class PartnerDto {
  @IsString()
  code: string;

  @IsString()
  id: string;
}

export class BaseCancelOrderDtoV2 {
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

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;
}

export class BaseUpdateOrderDtoV2 {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  awbNumber: string;

  @IsOptional()
  @IsString()
  partnerCode?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsString()
  orderStatus?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressV2Dto)
  addresses?: AddressV2Dto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ParentShipmentDto)
  parentShipment?: ParentShipmentDto;

  @IsOptional()
  @IsArray()
  childShipments?: any[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDto)
  payment?: PaymentDto;
}

export class BaseOrderReqDtoV2 extends BaseReqDto {
  @IsString()
  orderId: string;

  @IsString()
  referenceId: string;

  @IsOptional()
  @IsBoolean()
  mcn?: boolean;

  @IsOptional()
  @IsBoolean()
  assignAWBFromSeries?: boolean;

  @IsString()
  parcelCategory: string;

  @IsDateString()
  orderDate: string;

  @IsDateString()
  expectedDeliveryDate: string;

  @IsString()
  documentType: string;

  @IsString()
  orderType: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eWaybills?: string[];

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
  @ValidateNested({ each: true })
  @Type(() => ShipmentDto)
  childShipments: ShipmentDto[];

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

  @ValidateNested()
  @Type(() => PartnerDto)
  partner: PartnerDto;
}

export class OrderDtov2 {
  @IsString()
  orderId: string;

  @IsString()
  referenceId: string;

  @IsOptional()
  @IsBoolean()
  mcn?: boolean;

  @IsString()
  parcelCategory: string;

  @IsDateString()
  orderDate: string;

  @IsDateString()
  expectedDeliveryDate: string;

  @IsString()
  documentType: string;

  @IsString()
  orderType: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eWaybills?: string[];

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
  @ValidateNested({ each: true })
  @Type(() => ShipmentDto)
  childShipments: ShipmentDto[];

  @IsArray()
  vehicles: any[]; // Could be further typed if needed

  @IsArray()
  slots: any[]; // Could be further typed if needed

  @ValidateNested()
  @Type(() => PaymentDto)
  payment: PaymentDto;

  @IsOptional()
  @IsString()
  awbNumber?: string;

  @IsOptional()
  @IsString()
  partnerCode?: string;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  operation?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowContextDto)
  workflowContext?: WorkflowContextDto;

  @ValidateNested()
  @Type(() => PartnerDto)
  partner: PartnerDto;
}

export function extractLineItems(
  data: OrderDtov2 | BaseOrderReqDtoV2
): ItemDto[] {
  const extract = (item: ItemDto): Partial<ItemDto> => ({
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
  const childItems = (data.childShipments || []).flatMap((cs: ShipmentDto) =>
    (cs.items || []).map(extract)
  );
  return [...parentItems, ...childItems] as ItemDto[];
}
