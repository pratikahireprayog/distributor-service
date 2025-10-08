import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { COLLECTION_NAME_CONST } from "src/common/constants";

export type AwbSeriesDocument = AwbSeriesModel & Document;

@Schema({
  collection: COLLECTION_NAME_CONST.AWB_SERIES,
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
})
export class AwbSeriesModel {
  @Prop({ required: true, unique: true })
  partnerCode: string;

  @Prop({ required: true })
  seriesStart: number;

  @Prop({ required: true })
  seriesEnd: number;

  @Prop({ required: true })
  currentCounter: number;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({ type: [Number], default: [] })
  notificationThresholds: number[];

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const AwbSeriesSchema = SchemaFactory.createForClass(AwbSeriesModel);

// Index for partnerCode is automatically created by unique: true property
