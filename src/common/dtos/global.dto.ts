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

// Interface for Partner Model from eligible partner data
export interface PartnerModel {
    code: string;
    name: string;
    parent_id: string | null;
    created_at: string;
    id: number;
    partner_type_id: number;
    is_active: boolean;
    updated_at: string;
  }
  
  // Interface for eligible partner response
  export interface EligiblePartnersData {
    success: boolean;
    message: string;
    data: PartnerModel[];
    total: number;
  }
  