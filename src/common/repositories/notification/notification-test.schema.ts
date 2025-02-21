import { model, Model, Schema } from 'mongoose';

const ToSchema = new Schema(
  {
    sms: { type: String, required: false },
    email: { type: [String], required: false },
    whatsapp: { type: String, required: false },
  },
  { _id: false },
);

const AttachmentSchema = new Schema(
  {
    base64: { type: String, required: false },
    filename: { type: String, required: false },
    filetype: { type: String, required: false },
  },
  { _id: false },
);

const BatchSchema = new Schema(
  {
    to: { type: ToSchema, required: true },
    data: {
      type: Schema.Types.Mixed,
      required: false,
      attachment: { type: AttachmentSchema, required: false },
    },
  },
  { _id: false },
);

export const NotificationSchema = new Schema({
  notificationId: { type: String, required: true },
  event: { type: String, required: true },
  batch: { type: [BatchSchema], required: true },
  callbackURL: { type: [String], required: false },
  createdAt: { type: Date, required: true, default: Date.now },
  clientId: { type: String, required: true },
  clientType: { type: String, required: true },
});
