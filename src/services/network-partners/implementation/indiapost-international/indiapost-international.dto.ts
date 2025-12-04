// Authentication DTOs
export class IndiaPostInternationalAuthRequestDto {
  username: string;
  password: string;
}

export class IndiaPostInternationalAuthResponseDto {
  success: boolean;
  message?: string;
  data?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

// Sub Piece DTO
export class IndiaPostInternationalSubPieceDto {
  hs_cd: string;
  cth_cd: string;
  hs_description: string;
  sp_unit_cd: string;
  created_by: string;
  office_id_bkg: number;
  ip_address_bkg: string;
  article_number: string;
  igst_rate?: number;
  igst_amount?: number;
  export_duty_rate?: number;
  export_duty_amount?: number;
  cess_rate?: number;
  cess_amount?: number;
  compensation_cess_rate?: number;
  compensation_cess_amount?: number;
  tax_payment_channel_source?: string;
  tax_payment_mode_cd?: string;
  ecommerce_url?: string;
  sp_count: number;
  sp_weight_total: number;
  sp_weight_nett: number;
  sp_inv_currency_cd: string;
  sp_origin_country_cd: string;
  sp_comm_invoice_no: string;
  ecommerce_paytranid?: string;
  sp_tax_invoice_no: string;
  sp_tax_invoice_date: string;
  sp_invoice_value_total: number;
  sp_inv_currency_exchrate: number;
  sp_asbl_fob_value: number;
  sp_asbl_value_inr: number;
  channel_type_cd: string;
  sp_comm_invoice_date: string;
  ecommerce_sku?: string;
  sp_invoice_lsn?: number;
  sp_origin_currency_cd: string;
  sp_invoice_value: number;
  sp_asbl_currency_cd: string;
  sp_asbl_currency_exchrate: number;
  usertype_cd: string;
}

// Create Order Request DTO
export class IndiaPostInternationalCreateOrderRequestDto {
  destination_ccode: string;
  destination_cname: string;
  mail_type_cd: string;
  mail_class_cd: string;
  mail_nature_type_cd: string;
  booking_type_cd: string;
  bulk_customer_id: number;
  physical_weight: number;
  child_customer_id: number;
  mail_shape_cd: string;
  dimension_length: number;
  dimension_breadth: number;
  dimension_height: number;
  volumetric_weight: number;
  charged_weight: number;
  declared_value: number;
  priority_flag: boolean;
  non_dely_instns_cd: string;
  sender_name: string;
  sender_company_name: string;
  sender_addrline1: string;
  sender_addrline2?: string;
  sender_addrline3?: string;
  sender_city: string;
  sender_state: string;
  sender_country_name: string;
  sender_country_code: string;
  sender_email_id: string;
  sender_alt_contact_no: string;
  sender_kyc_reference: string;
  sender_tax_reference: string;
  sender_pincode: number;
  receiver_name: string;
  receiver_company_name?: string;
  receiver_addrline1: string;
  receiver_addrline2?: string;
  receiver_addrline3?: string;
  receiver_city: string;
  receiver_state: string;
  receiver_country: string;
  receiver_country_code: string;
  receiver_zipcode: string;
  receiver_email_id: string;
  receiver_alt_contact_no: string;
  receiver_kyc_reference?: string;
  receiver_tax_reference?: string;
  pbe_type_cd: string;
  pbe_bank_ref: string;
  upload_doc_inv_count: number;
  upload_doc_cert_count: number;
  upload_doc_lic_count: number;
  declaration1: boolean;
  declaration2: boolean;
  declaration3: boolean;
  declaration4: boolean;
  selffiling_cusbroker: boolean;
  cus_broker_lic_no?: string;
  cus_broker_name?: string;
  cus_broker_address?: string;
  article_number: string;
  bkg_ref_id: string;
  ip_address_bkg: string;
  user_type_cd: string;
  channel_type_cd: string;
  office_id_bkg: number;
  origin_office_name: string;
  sender_mobile_no: number;
  receiver_mobile_no: number;
  contract_id: number;
  status_cd: string;
  created_by: string;
  sender_gst_no: string;
  subpiece_count: number;
  iec_code: string;
  bkg_office_gst_no: string;
  pod_ack_charge?: number;
  sub_pieces: IndiaPostInternationalSubPieceDto[];
}

// Create Order Response DTO
export class IndiaPostInternationalCreateOrderResponseDto {
  success?: boolean;
  message?: string;
  data?: {
    Article?: {
      article_number?: string;
      pbe_no?: number;
      bkg_ref_id?: string;
      status_cd?: string;
      created_date?: string;
    };
    booking_id?: string;
    article_number?: string;
    tracking_number?: string;
    label_url?: string;
  };
}

