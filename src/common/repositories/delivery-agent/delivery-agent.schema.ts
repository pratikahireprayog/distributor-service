import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME_CONST } from 'src/common/constants';

export type DeliveryAgentDocument = DeliveryAgentModel & Document;

@Schema({ _id: false })
class ServiceablePincodes {
  @Prop({ type: [String], required: true })
  area: string[];

  @Prop({ required: true })
  pincode: string;
}

@Schema({
  collection: COLLECTION_NAME_CONST.DELIVERY_AGENT,
  timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' },
})
export class DeliveryAgentModel {
  @Prop()
  deviceId?: string;

  @Prop()
  deviceToken?: string;

  @Prop()
  mobile?: string;

  @Prop()
  uuid?: string;

  @Prop()
  createdDate?: Date;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  updatedDate?: Date;

  @Prop()
  city?: string;

  @Prop()
  aadharFrontPhotoUrl?: string;

  @Prop()
  dlFrontPhotoUrl?: string;

  @Prop()
  dlBackPhotoUrl?: string;

  @Prop()
  aadharNumber?: string;

  @Prop()
  dlNumber?: string;

  @Prop()
  panNumber?: string;

  @Prop()
  vehicleType?: string;

  @Prop()
  vehicleNumber?: string;

  @Prop()
  isUserOnboarded?: boolean;

  @Prop()
  assetStatus?: string;

  @Prop()
  lastUpdateStatus?: Date;

  @Prop()
  lastUpdateLocation?: Date;

  @Prop()
  refVendorCode?: string;

  // Uncomment and define these properties as needed
  // @Prop()
  // geoLocation?: any;

  // @Prop()
  // bankDetails?: any;

  // @Prop()
  // addressDetails?: any;

  // @Prop()
  // emergencyContactDetails?: any;

  // @Prop()
  // isActive?: boolean;

  // @Prop()
  // cashInHand?: number;

  // @Prop()
  // lastOnlineTime?: Date;

  // @Prop()
  // firstOnlineTime?: Date;

  // @Prop()
  // idealTimeInMinutes?: number;

  // @Prop()
  // loginTimeInMinutes?: number;

  // @Prop()
  // runTimeDistance?: number;

  // @Prop()
  // runTimeInMinutes?: number;

  // @Prop()
  // totalDistance?: number;

  // @Prop()
  // isActiveOn?: Date;

  // @Prop()
  // deliveryAgentId?: string;

  // @Prop()
  // isPrimaryDetailsApproved?: boolean;

  // @Prop()
  // isAddressDetailsApproved?: boolean;

  // @Prop()
  // isVehicleDetailsApproved?: boolean;

  // @Prop()
  // isDocumentDetailsApproved?: boolean;

  // @Prop()
  // isBankDetailsApproved?: boolean;

  // @Prop()
  // isEcontactDetailsApproved?: boolean;

  // @Prop()
  // orderProcessType?: any;

  // @Prop()
  // walletInfo?: any;

  // @Prop()
  // aadharDetails?: any;

  // @Prop()
  // panDetails?: any;

  // @Prop()
  // maxAllowedCashLimit?: number;

  // @Prop()
  // maxCashDepositDays?: number;

  // @Prop()
  // isDefaulter?: boolean;

  // @Prop()
  // partnerType?: any;

  // @Prop()
  // paymentType?: any;

  // @Prop()
  // assignedCities?: string;

  // @Prop()
  // assignedHotspot?: any;

  // @Prop()
  // assignedStates?: string;

  // @Prop()
  // managerDetails?: any;

  // @Prop()
  // onboardStatus?: any;

  // @Prop()
  // profilePhotoUrl?: string;

  // @Prop()
  // companyName?: string;
}

export const DeliveryAgentSchema =
  SchemaFactory.createForClass(DeliveryAgentModel);
