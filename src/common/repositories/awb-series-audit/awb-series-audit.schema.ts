import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { COLLECTION_NAME_CONST } from "src/common/constants";

export type AwbSeriesAuditDocument = AwbSeriesAuditModel & Document;

@Schema({
  collection: COLLECTION_NAME_CONST.AWB_SERIES_AUDIT,
  timestamps: { createdAt: "createdAt" },
})
export class AwbSeriesAuditModel {
  @Prop({ required: true })
  seriesId: string;

  @Prop({ required: true })
  partnerCode: string;

  @Prop({ required: true })
  awbNumber: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  consumedAt: Date;

  @Prop({ required: true })
  awbType: string; // "parent" or "child"

  @Prop()
  createdAt?: Date;
}

export const AwbSeriesAuditSchema =
  SchemaFactory.createForClass(AwbSeriesAuditModel);

// Create indexes for faster lookups
AwbSeriesAuditSchema.index({ seriesId: 1 });
AwbSeriesAuditSchema.index({ partnerCode: 1 });
AwbSeriesAuditSchema.index({ orderId: 1 });
AwbSeriesAuditSchema.index({ awbNumber: 1 });
