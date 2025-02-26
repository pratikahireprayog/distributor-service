import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { COLLECTION_NAME_CONST } from 'src/common/constants';

export type StatusTrackingDocument = StatusTrackingModel & Document;

@Schema({
    collection: COLLECTION_NAME_CONST.STATUS_TRACKING,
    timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' },
})
export class StatusTrackingModel {
    @Prop({ type: MongooseSchema.Types.ObjectId, required: false, auto: true })
    _id?: string;

    @Prop({ required: false })
    waybillNo: string;

    @Prop({ required: false })
    awbNumber: string;

    @Prop({ required: false })
    courierComment: string;

    @Prop({ type: Date, required: false })
    createdDate: Date;

    @Prop({ type: Date, required: false })
    updatedDate: Date;

    @Prop({ required: false })
    currentLocation: string;

    @Prop({ required: false })
    isPushedToClient: boolean;

    @Prop({ required: false })
    lat: number;

    @Prop({ required: false })
    long: number;

    @Prop({ required: false })
    orderStatus: string;

    @Prop({ required: false })
    podLink: string;

    @Prop({ required: false })
    status: string;

    @Prop({ required: false })
    statusCode: string;

    @Prop({ type: Date, required: false })
    statusUpdatedDate: Date;

    @Prop({ required: false })
    statusDate: string;

    @Prop({ required: false })
    deliveryId: string;

    @Prop({ required: false })
    drsNo: string;

    @Prop({ required: false })
    pushedTo: string;

    @Prop({ required: false })
    hubId: number;

    @Prop({ required: false })
    shipmentType: string;

    @Prop({ required: false })
    reason: string;

    @Prop({ required: false })
    carrierTrackingId: string;

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
    systemOrderId: string;

    @Prop({ required: false })
    trackingType: string;

    @Prop({ required: false })
    invoice_id: string;

    @Prop({ required: false })
    orderManifestDatetime: string;

    @Prop({ required: false })
    currentTrackingDatetime: string;
}

export const StatusTrackingSchema = SchemaFactory.createForClass(StatusTrackingModel); 