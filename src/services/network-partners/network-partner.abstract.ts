import { Injectable } from '@nestjs/common';
import { ResponseDto } from 'src/common/dtos/global.dto';

@Injectable()
export abstract class NetworkPartner {
    protected abstract readonly baseUrl: string;
    protected abstract readonly envUrl: string;

    abstract manifestOrder(request: any): Promise<ResponseDto>;
    // abstract getTrackingStatuses(trackingId: string): Promise<any>;
    // abstract cancelOrder(trackingIds: string[]): Promise<any>;
    // abstract getOrderShippingRates(request: any): Promise<any>;
    // abstract getLabelData(trackingId: string, systemOrderId: string): Promise<any>;
} 