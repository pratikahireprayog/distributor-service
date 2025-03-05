import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import * as mongoose from 'mongoose';

// Nested class for PayloadMapperField
class PayloadMapperField {
    @Prop({
        required: true,
        type: mongoose.Schema.Types.Mixed // Use Mixed type for union types
    })
    sources: string | string[];

    @Prop({ required: true })
    destination: string;

    @Prop({ required: false })
    transform?: string;

    // Example usage of transform:
    // To prefix a value with "SM", use: transform: "value ? 'SM' + value : ''"
    // For array values: transform: "Array.isArray(value) ? value.map(v => 'SM' + v) : ['SM' + value]"
    // For ternary operators: transform: "isCOD ? 'cod' : 'prepaid'" (spaces around ? and : are recommended)
    // You can use either 'value' or the source field name as the variable in the expression
}

// Nested class for PayloadMapperConfig
class PayloadMapperConfig {
    @Prop({ type: [PayloadMapperField], required: true })
    fields: PayloadMapperField[];

    @Prop({ required: false, default: true })
    createNewObject?: boolean;
}

// Nested class for URL Parameter Mapping
class UrlParamMapping {
    @Prop({ required: true })
    paramName: string;

    @Prop({ required: true })
    sourceField: string;
}

// Nested class for Query Parameter Mapping
class QueryParamMapping {
    @Prop({ required: true })
    paramName: string;

    @Prop({ required: true })
    sourceField: string;
}

// Nested class for Header Mapping
class HeaderMapping {
    @Prop({ required: true })
    headerName: string;

    @Prop({ required: true })
    sourceField: string;

    @Prop({ required: false })
    defaultValue?: string;
}

// Nested class for Response Mapping
class ResponseMapping {
    @Prop({ type: PayloadMapperConfig, required: false })
    mapperConfig?: PayloadMapperConfig;
    
    @Prop({ required: false })
    successPath?: string; // JSON path to success indicator (e.g., "status" or "result.success")
    
    @Prop({ required: false })
    dataPath?: string; // JSON path to extract data (e.g., "data" or "result.data")
    
    @Prop({ required: false })
    errorPath?: string; // JSON path to error message (e.g., "error" or "result.message")
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

    @Prop({ type: PayloadMapperConfig, required: false })
    payloadMapperConfig?: PayloadMapperConfig;

    @Prop({ required: true })
    partnerId: string;
    
    // New fields for enhanced flexibility
    @Prop({ type: [UrlParamMapping], required: false })
    urlParamMapping?: UrlParamMapping[];
    
    @Prop({ type: [QueryParamMapping], required: false })
    queryParamMapping?: QueryParamMapping[];
    
    @Prop({ type: [HeaderMapping], required: false })
    headerMapping?: HeaderMapping[];
    
    @Prop({ type: ResponseMapping, required: false })
    responseMapping?: ResponseMapping;
    
    // Optional timeout configuration in milliseconds
    @Prop({ required: false, default: 30000 })
    timeout?: number;
    
    // Optional retry configuration
    @Prop({ required: false, default: 0 })
    retryCount?: number;
    
    @Prop({ required: false, default: 1000 })
    retryDelay?: number;

    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
}

export type EndpointConfigDocument = EndpointConfigModel & Document;
export const EndpointConfigSchema = SchemaFactory.createForClass(EndpointConfigModel);