export interface BaseManifestReqDto {
    awbNumber: string;
    partnerCode: string;
}

export interface BaseManifestResDto {
    statusCode: boolean;
    message: string;
    data: any;
}