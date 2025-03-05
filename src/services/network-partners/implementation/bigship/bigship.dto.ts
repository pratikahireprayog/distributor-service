import { IsString } from "class-validator";
import { BaseReqDto, BaseResDto } from "src/common/dtos/base.dto";

export class AwbNumberResDto {
    @IsString()
    courier_id: string;

    @IsString()
    courier_name: string;

    @IsString()
    lr_number: string;

    @IsString()
    master_awb: string;
}

export class ShipmentDataResDto {
    data: AwbNumberResDto;
    success: boolean;
    message: string;
    responseCode: number;
}


export interface BigshipManifestReqDto extends BaseReqDto {
    systemOrderId: number;
    courierId: number;
    riskType: string;
    type: string;
    subPartnerCode: string;
}

export interface BigshipManifestResDto extends BaseResDto {
    responseCode: number;
    success: boolean
    data: {
        master_awb?: string;
        lr_number?: string;
        courier_name: string;
    };
}