// import { IsString } from "class-validator";
// import { BaseReqDto, BaseOrderReqDto, BaseOrderResDto, BaseResDto } from "src/common/dtos/base.dto";

// export class TsawTrackingNumberResDto {
//     @IsString()
//     trackingId: string;

//     @IsString()
//     carrierName: string;

//     @IsString()
//     referenceNumber: string;
// }

// export class TsawShipmentDataResDto {
//     data: TsawTrackingNumberResDto;
//     success: boolean;
//     message: string;
//     responseCode: number;
// }

// export interface TsawManifestReqDto extends BaseReqDto {
//     orderId: number;
//     carrierId: number;
//     shipmentType: string;
//     serviceType: string;
// }

// export interface TsawManifestResDto extends BaseResDto {
//     responseCode: number;
//     success: boolean;
//     data: {
//         trackingId?: string;
//         referenceNumber?: string;
//         carrierName: string;
//     };
// }

// export interface TsawOrderReqDto extends BaseOrderReqDto {
//     carrierId: number;
//     shipmentType: string;
//     serviceType: string;
// }

// export interface TsawOrderResDto extends BaseOrderResDto {
//     responseCode: number;
//     success: boolean;
//     data: {
//         trackingId?: string;
//         referenceNumber?: string;
//         carrierName: string;
//     };
// } 