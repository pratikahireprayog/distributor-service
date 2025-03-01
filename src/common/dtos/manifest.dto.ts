export interface BaseManifestDto {
    awbNumber: string;
    systemOrderId: number;
    partnerCode: string;
}

export interface BaseManifestResponse {
    success: boolean;
    message: string;
}

// Partner-specific DTOs extend the base
export interface BigshipManifestDto extends BaseManifestDto {
    courierId: number;
    riskType: string;
    type: string;
    subPartnerCode: string;
}

export interface BigshipManifestResponse extends BaseManifestResponse {
    responseCode: number;
    data: {
        master_awb?: string;
        lr_number?: string;
        courier_name: string;
    };
}

// Example of another partner DTO
// export interface DelhiveryManifestDto extends BaseManifestDto {
//     warehouseCode: string;
//     serviceType: string;
//     pickupDate?: string;
//     dimensions?: {
//         length: number;
//         width: number;
//         height: number;
//         weight: number;
//     };
// }

// export interface DelhiveryManifestResponse extends BaseManifestResponse {
//     trackingId: string;
//     statusCode: number;
//     estimatedDeliveryDate?: string;
//     shipmentDetails?: {
//         origin: string;
//         destination: string;
//         currentStatus: string;
//     };
// }

// Add more partner DTOs as needed
// For example:
// export interface DelhiveryManifestDto extends BaseManifestDto {
//   warehouseCode: string;
//   serviceType: string;
// }
// 
// export interface DelhiveryManifestResponse extends BaseManifestResponse {
//   trackingId: string;
//   statusCode: number;
// } 