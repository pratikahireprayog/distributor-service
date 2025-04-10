import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { COLLECTION_NAME_CONST } from "src/common/constants";

export type OrderPartnerHistoryDocument = OrderPartnerHistoryModel & Document;

@Schema({
  collection: COLLECTION_NAME_CONST.ORDER_PARTNER_HISTORY,
  timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" },
})
export class OrderPartnerHistoryModel {
  @Prop({ required: true, index: true })
  awbNumber: string;

  @Prop({ required: true, index: true })
  partnerCode: string;

  @Prop({ required: true })
  partnerName: string;

  @Prop({ type: Number, required: true })
  attemptNumber: number;

  @Prop({ type: Boolean, required: true })
  isSuccessful: boolean;

  @Prop({ type: Date, required: true })
  attemptedAt: Date;

  @Prop({ type: Object })
  requestData?: Record<string, any>;

  @Prop({ type: Object })
  responseData?: Record<string, any>;

  @Prop({ type: String })
  errorCode?: string;

  @Prop({ type: String })
  errorMessage?: string;

  @Prop({ type: Object })
  errorDetails?: Record<string, any>;

  @Prop({ type: Number })
  responseTimeMs?: number;
}

export const OrderPartnerHistorySchema = SchemaFactory.createForClass(
  OrderPartnerHistoryModel
);
