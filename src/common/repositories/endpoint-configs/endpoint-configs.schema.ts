import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

// Nested class for PayloadMapperField
class PayloadMapperField {
    @Prop({ required: true })
    sources: string;

    @Prop({ required: true })
    destination: string;
}

// Nested class for PayloadMapperConfig
class PayloadMapperConfig {
    @Prop({ type: [PayloadMapperField], required: true })
    fields: PayloadMapperField[];
}

@Schema({
    timestamps: true,
    collection: 'EndpointConfigs'
})
export class EndpointConfigModel {
    @Prop({ type: MongooseSchema.Types.ObjectId, required: false, auto: true })
    _id?: string;

    @Prop({ required: false })
    name?: string;

    @Prop({ required: true })
    method: string;

    @Prop({ required: true })
    endpointId: string;

    @Prop({ required: true })
    partnerCode: string;

    @Prop({ required: true })
    requiresAuth: boolean;

    @Prop({ required: false })
    contentType: string;

    @Prop({ required: true })
    url: string;

    @Prop({ type: PayloadMapperConfig, required: true })
    payloadMapperConfig: PayloadMapperConfig;

    @Prop({ required: true })
    partnerId: string;

    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
}

export type EndpointConfigDocument = EndpointConfigModel & Document;
export const EndpointConfigSchema = SchemaFactory.createForClass(EndpointConfigModel); 