export interface ToModel {
  sms?: string;
  email?: string[];
  whatsapp?: string;
  [key: string]: any;
}

export interface AttachmentModel {
  base64: string;
  filename: string;
  filetype: string;
}

export interface BatchModel {
  to: ToModel;
  data: {
    [key: string]: any;
    attachment?: AttachmentModel;
  };
}

export interface NotificationModel {
  notificationId: string;
  event: string;
  batch: BatchModel[];
  callbackURL: string[];
  createdAt: Date;
  clientId: string;
  clientType: string;
}
