import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { COLLECTION_NAME_CONST } from 'src/common/constants';

export type NotificationLogDocument = NotificationLogModel & Document;

@Schema({
  collection: COLLECTION_NAME_CONST.NOTIFICATION_LOG,
  timestamps: { createdAt: 'createdAt' },
})
export class NotificationLogModel {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false, auto: true })
  _id?: string;

  @Prop({ required: false })
  requestId: string;

  @Prop({ required: false })
  notificationId: string;

  @Prop({ required: false })
  clientId: string;

  @Prop({ required: false })
  clientType: string;

  @Prop({ required: false })
  recipient: string;

  @Prop({ required: false })
  status: string;

  @Prop()
  errorMessage: string;

  @Prop({ required: false })
  sentTime: string;

  @Prop({ required: false })
  channel: string;

  @Prop({ required: false })
  provider: string;

  @Prop({ required: false })
  event: string;

  @Prop({ required: false })
  template: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ required: false })
  messageId: string;

  @Prop({ required: false })
  integrationAccountName: string;
}

export const NotificationLogSchema =
  SchemaFactory.createForClass(NotificationLogModel);
