import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME_CONST } from 'src/common/constants';

export type MPUserDocument = MPUserModel & Document;

@Schema({
  collection: COLLECTION_NAME_CONST.MP_USER,
  timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' },
})
export class MPUserModel {
  @Prop({ required: true })
  name: string;

  @Prop()
  email?: string;

  @Prop()
  photoUrl?: string;

  @Prop()
  isActive?: boolean;

  @Prop({ required: true })
  id: string;
}

export const MPUserSchema = SchemaFactory.createForClass(MPUserModel);
