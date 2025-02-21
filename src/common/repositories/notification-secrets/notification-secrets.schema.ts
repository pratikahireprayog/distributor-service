import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME_CONST } from 'src/common/constants';

export type NotificationSecretsDocument = NotificationSecretsModel & Document;

@Schema({
  collection: COLLECTION_NAME_CONST.NOTIFICATION_SECRETS,
  timestamps: true, // This will add createdAt and updatedAt fields
})
export class NotificationSecretsModel {
  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  fynoApiKey: string;

  @Prop({ required: true })
  wsid: string;
}

export const NotificationSecretsSchema = SchemaFactory.createForClass(
  NotificationSecretsModel,
);
