export class ResponseDto {
    statusCode: number;
    message: string;
    data?: any;
}

export interface CreateManifestDto {
    awbNumber: string;
    systemOrderId: number;
    courierId: number;
    riskType: string;
    type: string;
    partnerCode: string;
    subPartnerCode: string;
} 