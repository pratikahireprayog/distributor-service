import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { COLLECTION_NAME_CONST } from 'src/common/constants';

export type NotificationDocument = NotificationModel & Document;

@Schema({ _id: false })
class ToModel {
  @Prop({ type: String, required: false, default: undefined })
  sms?: string;

  @Prop({
    type: [String],
    required: false,
    default: undefined,
  })
  email?: string | string[];

  @Prop({ type: String, required: false, default: undefined })
  whatsapp?: string;
}

@Schema({ _id: false })
class AttachmentModel {
  @Prop()
  base64?: string;

  @Prop()
  filename?: string;

  @Prop()
  filetype?: string;
}

@Schema({ _id: false })
class BatchModel {
  @Prop({ type: ToModel })
  to: ToModel;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: false,
  })
  data: {
    [key: string]: any;
    attachment?: AttachmentModel;
  };
}

@Schema({
  collection: COLLECTION_NAME_CONST.NOTIFICATION,
  timestamps: { createdAt: 'createdDate' },
})
export class NotificationModel {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false, auto: true })
  _id?: string;

  @Prop({ required: false })
  notificationId?: string;

  @Prop({ required: false })
  event?: string;

  @Prop({ type: [BatchModel], required: false })
  batch?: BatchModel[];

  @Prop([String])
  callbackURL?: string[];

  @Prop({ default: Date.now, required: false })
  createdAt?: Date;

  @Prop({ required: false })
  clientId?: string;

  @Prop({ required: false })
  clientType?: string;
}

export const NotificationSchema =
  SchemaFactory.createForClass(NotificationModel);
