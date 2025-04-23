import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { COLLECTION_NAME_CONST } from "src/common/constants";

export type OrderPartnerDocument = OrderPartnerModel & Document;

// Interface for Partner in OrderPartnerModel
export interface Partner {
  code: string;
  name: string;
  partner_id: number;
  attempts: number;
  last_attempt_at?: Date;
  is_successful?: boolean;
  error_code?: string;
  error_message?: string;
}

@Schema({
  collection: COLLECTION_NAME_CONST.ORDER_PARTNER,
  timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" },
})
export class OrderPartnerModel {
  @Prop({ required: true, unique: true, index: true })
  awbNumber: string;

  @Prop({ type: [Object], required: true })
  eligiblePartners: Partner[];

  @Prop({ type: String, required: false })
  currentPartnerCode?: string;

  @Prop({ type: Number, default: 0 })
  retryCount: number;

  @Prop({ type: Date })
  lastRetryAt?: Date;

  @Prop({ type: Boolean, default: false })
  orderCreated: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const OrderPartnerSchema =
  SchemaFactory.createForClass(OrderPartnerModel);
