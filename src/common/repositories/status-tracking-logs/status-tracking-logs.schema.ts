import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { COLLECTION_NAME_CONST } from 'src/common/constants';

export type StatusTrackingLogsDocument = StatusTrackingLogsModel & Document;

@Schema({
    collection: COLLECTION_NAME_CONST.STATUS_TRACKING_LOGS,
    timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' },
})
export class StatusTrackingLogsModel {
    @Prop({ type: MongooseSchema.Types.ObjectId, required: false, auto: true })
    _id?: string;

    @Prop({ required: false })
    waybillNo: string;

    @Prop({ required: false })
    awbNumber: string;

    @Prop({ required: false })
    status: string;

    @Prop({ required: false })
    carrierTrackingId: string;

    @Prop({ type: Date, required: false })
    statusUpdatedDate: Date;

    @Prop({ required: false })
    pushedTo: string;

    @Prop({ required: false })
    reason: string;

    @Prop({ required: false })
    lrNumber: string;

    @Prop({ required: false })
    scanDatetime: string;

    @Prop({ required: false })
    scanLocation: string;

    @Prop({ required: false })
    courierName: string;

    @Prop({ required: false })
    courierId: number;

    @Prop({ required: false })
    trackingType: string;

    @Prop({ required: false })
    invoiceId: string;

    @Prop({ required: false })
    orderManifestDatetime: string;

    @Prop({ required: false })
    currentTrackingDatetime: string;

    @Prop({ required: false })
    systemOrderId: string;
}

export const StatusTrackingLogsSchema = SchemaFactory.createForClass(StatusTrackingLogsModel); 