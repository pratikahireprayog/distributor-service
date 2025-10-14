// Base DTOs extending your existing base classes
import {
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
  BaseCancelOrderDto,
  ManifestReqDto,
} from "src/common/dtos/base.dto";

// ================================
// AUTHENTICATION DTOs
// ================================

// Authentication DTOs as per new documentation
export interface IndiaPostDomesticLoginReqDto {
  username: string;
  password: string;
}

export interface IndiaPostDomesticLoginResDto {
  success: boolean;
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in: number;
    refresh_expires_in: number;
  };
}

export interface IndiaPostDomesticRefreshTokenReqDto {
  refreshToken: string;
}

export interface IndiaPostDomesticRefreshTokenResDto {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ================================
// PINCODE/OFFICE DTOs
// ================================

// Pincode Search DTOs as per new documentation
export interface IndiaPostDomesticPincodeSearchReqDto {
  pincode: string;
  limit?: number;
  "office-type": string;
}

export interface IndiaPostDomesticPincodeSearchResDto {
  pincode: number;
  office_name: string;
  office_id: string;
  office_type_code: string;
  state_name: string;
  delivery_office_flag: boolean;
  city_name: string;
  taluk_name: string;
  village_name: string;
  is_rolled_out: boolean;
}

// Legacy DTOs for backward compatibility
export interface IndiaPostDomesticOfficeSearchReqDto extends BaseReqDto {
  skip?: number;
  limit?: number;
  "office-type"?: string;
  pincode?: string;
}

export interface IndiaPostDomesticOfficeDetailsDto {
  office_name?: string;
  office_type?: string;
  pincode?: string;
  district?: string;
  state?: string;
  region?: string;
  circle?: string;
  // Add other office fields as per API response
}

export interface IndiaPostDomesticOfficeSearchResDto extends BaseResDto {
  data?: IndiaPostDomesticOfficeDetailsDto[];
  total_count?: number;
}

// ================================
// BULK BOOKING DTOs (as per new documentation)
// ================================

export interface IndiaPostDomesticBulkBookingArticleDto {
  bulk_customer_id: string; // 10 digits
  contract_id: string; // 8 digits
  barcode_no?: string; // 13 characters, optional
  pickup_or_dropoff: "PICKUP" | "DROPOFF";
  article_type: "SP" | "BP"; // SP = Speed Post, BP = Business Parcel
  physical_weight: number; // 1-35000 grams
  shape_of_article?: "ROLL" | "NROL" | "DOC";
  length?: number; // Max 100
  breadth_diameter?: number; // Max 100
  height?: number; // Max 100
  priority_flag?: boolean;
  delivery_instruction?: "ND" | "OD" | "SD";
  delivery_slot?: "9am-2pm" | "2pm-5pm" | "5pm-8pm";
  instruction_rts?: "RTS" | "RTA";

  // Sender information
  sender_name: string; // 3-80 characters
  sender_company: string; // 3-80 characters
  sender_add_line_1: string; // 3-80 characters
  sender_add_line_2?: string; // 3-80 characters
  sender_city: string; // 3-80 characters
  sender_state?: string; // 3-80 characters
  sender_pincode: number; // 6 digits
  sender_emailid?: string; // 3-80 characters
  sender_alt_contact?: number; // 10 digits
  sender_kyc?: string; // 20 characters
  sender_tax_reference?: string; // 20 characters

  // Receiver information
  receiver_name: string; // 3-80 characters
  receiver_company: string; // 3-80 characters
  receiver_add_line_1: string; // 3-80 characters
  receiver_add_line_2?: string; // 3-80 characters
  receiver_city: string; // 3-80 characters
  receiver_state?: string; // 3-80 characters
  receiver_pincode: number; // 6 digits
  receiver_emailid?: string; // 3-80 characters
  receiver_alt_contact?: number; // 10 digits
  receiver_kyc?: string; // 20 characters
  receiver_tax_reference?: string; // 20 characters

  // Address flags
  alt_address_flag: boolean;
  pickup_address_flag: boolean;
  drop_off_pincode: number; // 6 digits

  // Contact information
  sender_mobile_no: number; // 10 digits
  receiver_mobile_no: number; // 10 digits

  // Payment information
  prepayment_code?: "PS" | "FM" | "SS";
  value_of_prepayment?: number; // 10,2 decimal
  codr_cod?: "COD" | "CODR";
  value_for_codr_cod?: number; // 10,2 decimal
  insurance_type?: "DOP";
  value_of_insurance?: number; // 10,2 decimal
  ack?: boolean;
  bulk_reference: string; // 50 characters

  // Pickup address (when pickup_address_flag is true)
  pickup_address_id?: number; // 8 digits
  pickup_addressee_name?: string; // 3-80 characters
  pickup_company_name?: string; // 3-80 characters
  pickup_address_line1?: string; // 3-80 characters
  pickup_address_line2?: string; // 3-80 characters
  pickup_address_line3?: string; // 3-80 characters
  pickup_city?: string; // 3-80 characters
  pickup_state?: string; // 3-80 characters
  pickup_pincode?: number; // 6 digits
  pickup_email_id?: string; // 3-80 characters
  pickup_alt_contact_no?: number; // 10 digits
  pickup_mobile_no?: number; // 10 digits
  pickup_schedule_slot?: string; // Time slots like "08:00-09:00"
  pickup_schedule_date?: string; // dd-mm-yyyy format

  // Alternative address (when alt_address_flag is true)
  alt_addressee_name?: string; // 3-80 characters
  alt_company_name?: string; // 3-80 characters
  alt_address_line1?: string; // 3-80 characters
  alt_address_line2?: string; // 3-80 characters
  alt_address_line3?: string; // 3-80 characters
  alt_city?: string; // 3-80 characters
  alt_state?: string; // 3-80 characters
  alt_pincode?: number; // 6 digits
  alt_email_id?: string; // 3-80 characters
  alt_contact_no?: number; // 10 digits
  alt_alternate_mobile_no?: number; // 10 digits
}

export interface IndiaPostDomesticBulkBookingReqDto {
  articles: IndiaPostDomesticBulkBookingArticleDto[];
}

export interface IndiaPostDomesticBulkBookingValidArticleDto {
  barcode_no: string;
  index: number;
  timestamp: string;
  offset_number: string;
  block_number: number;
  calculated_tariff: number;
  currency: string;
}

export interface IndiaPostDomesticBulkBookingErrorArticleDto {
  barcode_no: string;
  index: number;
  timestamp: string;
  offset_number: null;
  block_number: null;
  errors: string[];
}

export interface IndiaPostDomesticBulkBookingSummaryDto {
  success_count: number;
  error_count: number;
  total_tariff_amount: number;
}

export interface IndiaPostDomesticBulkBookingResDto {
  success: boolean;
  batch_id: string;
  custom_id: string;
  mail_booking_dom_id: number;
  correlation_id: string;
  timestamp: string;
  input_method: string;
  total: number;
  processed: number;
  valid_articles: IndiaPostDomesticBulkBookingValidArticleDto[];
  error_articles: IndiaPostDomesticBulkBookingErrorArticleDto[];
  summary: IndiaPostDomesticBulkBookingSummaryDto;
}

// Legacy booking DTOs for backward compatibility
export interface IndiaPostDomesticBookingReqDto extends BaseOrderReqDto {
  // Basic booking info
  mail_type_cd?: string;
  mail_class_cd?: string;
  mail_nature_type_cd?: string;
  booking_type_cd?: string;
  bulk_customer_id?: number;

  // Physical attributes
  physical_weight?: number;
  dimension_length?: number;
  dimension_breadth?: number;
  dimension_height?: number;
  volumetric_weight?: number;
  charged_weight?: number;

  // Sender information
  sender_name?: string;
  sender_company_name?: string;
  sender_addrline1?: string;
  sender_addrline2?: string;
  sender_addrline3?: string;
  sender_city?: string;
  sender_state?: string;
  sender_pincode?: number;
  sender_contact_no?: string;
  sender_email_id?: string;

  // Receiver information
  receiver_name?: string;
  receiver_company_name?: string;
  receiver_addrline1?: string;
  receiver_addrline2?: string;
  receiver_addrline3?: string;
  receiver_city?: string;
  receiver_state?: string;
  receiver_pincode?: number;
  receiver_contact_no?: string;
  receiver_email_id?: string;

  // Pricing
  base_tariff?: number;
  tax_amount?: number;
  total_tariff?: number;

  // Service options
  declared_value?: number;
  insurance_type?: string;
  value_insurance?: number;
  door_delivery_charge?: number;

  // Office info
  origin?: number;
  office_id_bkg?: number;
  origin_office_name?: string;

  // System fields
  created_by?: string;
  counter_no?: number;
  shift_no?: number;
  ip_address_bkg?: string;
  user_type_cd?: string;
  channel_type_cd?: string;

  // Article info
  article_number?: string;
  status_cd?: string;
  bkg_ref_id?: string;
}

export interface IndiaPostDomesticBookingResDto extends BaseOrderResDto {
  article_number?: string;
  booking_id?: string;
  status?: string;
  created_date?: string;
  total_amount?: number;
  tracking_url?: string;
}

// ================================
// TRACKING DTOs
// ================================

export interface IndiaPostDomesticTrackingReqDto extends BaseReqDto {
  article_number: string;
}

export interface IndiaPostDomesticTrackingResDto extends BaseResDto {
  article_number?: string;
  current_status?: string;
  last_update_time?: string;
  delivery_date?: string;
  tracking_history?: IndiaPostDomesticTrackingEventDto[];
}

export interface IndiaPostDomesticTrackingEventDto {
  event_date?: string;
  event_time?: string;
  event_description?: string;
  office_name?: string;
  status_code?: string;
}

// ================================
// ARTICLE GENERATION DTOs
// ================================

export interface IndiaPostDomesticArticleReqDto {
  article_type: string;
  office_customer: string;
}

export interface IndiaPostDomesticArticleResDto extends BaseResDto {
  article_number?: string;
  barcode?: string;
}

// ================================
// MANIFEST DTOs
// ================================

export interface IndiaPostDomesticManifestReqDto extends ManifestReqDto {
  office_id?: number;
  manifest_date?: string;
  article_numbers?: string[];
}

export interface IndiaPostDomesticManifestResDto extends BaseResDto {
  manifest_id?: string;
  manifest_number?: string;
  total_articles?: number;
  total_weight?: number;
}

// ================================
// DoP INTEGRATION SPECIFIC DTOs
// ================================

// Tariff API DTOs as per new documentation

// International Tariff DTOs
export interface IndiaPostDomesticInternationalTariffReqDto {
  "product-code": string; // FGN_LETTER, FGN_PARCEL, EMS
  weight: number;
  "country-code": string;
  registration?: boolean;
  insurance?: boolean;
  "ins-amount"?: number;
}

export interface IndiaPostDomesticInternationalTariffResDto {
  chargeable_weight: number;
  country: string;
  price: number;
  registration_charge: number;
  insurance_charge: number;
  base_tariff: number;
  igst: number;
  cgst: number;
  sgst: number;
  gst: number;
  total_with_tax: number;
  success: boolean;
}

// Parcel Tariff DTOs
export interface IndiaPostDomesticParcelTariffReqDto {
  "product-code": string; // PARCEL
  weight: number;
  "source-pincode": number;
  "destination-pincode": number;
  length: number;
  width: number;
  height: number;
  cod?: boolean;
  "cod-amount"?: number;
  insurance?: boolean;
  "ins-amount"?: number;
}

export interface IndiaPostDomesticParcelTariffResDto {
  chargeable_weight: number;
  volumetric_weight: number;
  price: number;
  distance: number;
  cod_charge: number;
  insurance_charge: number;
  base_tariff: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  total_with_tax: number;
  success: boolean;
}

// Letter Tariff DTOs
export interface IndiaPostDomesticLetterTariffReqDto {
  "product-code": string; // LETTER
  weight: number;
  "source-pincode": number;
  "destination-pincode": number;
  reg?: boolean;
  ack?: boolean;
  ins?: boolean;
  "ins-amount"?: number;
}

export interface IndiaPostDomesticLetterTariffResDto {
  chargeable_weight: number;
  price: number;
  registration_charge: number;
  ack_charge: number;
  insurance_charge: number;
  base_tariff: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  total_with_tax: number;
  success: boolean;
}

// Speed Post Tariff DTOs
export interface IndiaPostDomesticSpeedPostTariffReqDto {
  "product-code": string; // SP
  weight: number;
  "source-pincode": number;
  "destination-pincode": number;
  length: number;
  width: number;
  height: number;
  INS?: number;
  POD?: string; // "YES" or "NO"
}

export interface IndiaPostDomesticSpeedPostTariffResDto {
  chargeable_weight: number;
  volumetric_weight: number;
  distance: number;
  price: number;
  insurance_charge: number;
  pod_charge: number;
  base_tariff: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  total_with_tax: number;
  success: boolean;
}

// Legacy tariff DTOs for backward compatibility
export interface IndiaPostDomesticTariffReqDto {
  service: string; // SP, BP, RL, RP
  sourcepin: string;
  destinationpin: string;
  weight: string;
  length: string;
  breadth: string;
  height: string;
  POD_ACK_Flag?: string; // "Yes" or "No"
  VPP_Value?: number;
  INS_Value?: number;
  COD_Value?: number;
}

export interface IndiaPostDomesticTariffResDto {
  "Validation Status": string;
  "Chargeable Weight"?: string;
  "Base Tariff"?: string;
  "Service Tax"?: string;
}

// Label API DTOs as per new documentation
export interface IndiaPostDomesticLabelReqDto {
  identifier: string; // "Domestic"
  delivery_office_name: string;
  booking_datetime: string; // "27/08/2025, 22:56:04"
  channel_type: string; // "E"
  user_type: string; // "R"
  user_id: number;
  barcode_no: string;
  service_type: string; // "LETTER"
  booking_type: string; // "COM"
  customer_id: number;
  article_length: string;
  article_breadth: string;
  article_height: string;
  prepaid_flag: boolean;
  prepaid_type: string;
  prepaid_value: number;
  vpcod_type: string; // "CODR"
  vpcod_value: number;
  insurance_flag: boolean;
  insurance_value: number;
  physical_weight: number;
  volumetric_weight: number;
  recipient_name: string;
  recipient_mobile: string;
  recipient_addressl1: string;
  recipient_addressl2: string;
  recipient_addressl3: string;
  recipient_city: string;
  recipient_pin: string;
  recipient_state: string;
  sender_name: string;
  sender_mobile: string;
  sender_addressl1: string;
  sender_addressl2: string;
  sender_addressl3: string;
  sender_city: string;
  sender_pin: string;
  sender_state: string;
  transmission_mode: string;
  payment_mode: string; // "QR"
  routing_data: string;
  booking_office_name: string;
  booking_office_pin: string;
  size: string; // "A7"
  total_amount: number;
  value_added_services: string; // "ND"
}

export interface IndiaPostDomesticLabelResDto {
  // Returns PDF file with addresses and barcode
  success: boolean;
  pdf_url?: string;
  error?: string;
}

// Event Sharing DTOs as per new documentation
export interface IndiaPostDomesticEventDownloadReqDto {
  Cust_Id: string; // 10 digit customer ID
  Event_Code: string; // "LE", "IB", "ID", "RT"
  Event_Date: string; // ddmmyyyy format (e.g., "01052022" for 01/05/2022)
}

export interface IndiaPostDomesticEventDownloadResDto {
  // Returns XML data with event details
  success: boolean;
  xml_data?: string;
  error?: string;
}

// Latest Event XML structure as per DoP Document
export interface IndiaPostDomesticLatestEventDetailsDto {
  ArticleNumber: string;
  ArticleType?: string;
  BookingDate?: string; // DDMMYYYY
  BookingTime?: string; // HHMMSS
  BookingOfficeFacilityID?: string;
  BookingOfficeName?: string;
  BookingPIN?: string;
  SenderAddressCity?: string;
  DestinationOfficeFacilityID?: string;
  DestinationOfficeName?: string;
  DestinationPIN?: string;
  DestinationCity?: string;
  DestinationCountry?: string;
  ReceiverName?: string;
  InvoiceNo?: string;
  LineItem?: string;
  WeightValue?: string;
  Tariff?: string;
  CODAmount?: string;
  BookingType?: string;
  ContractNumber?: string;
  EventCode: string;
  EventDescription: string;
  EventOfficeFaciltyID: string;
  EventOfficeName: string;
  EventDate: string; // DDMMYYYY
  EventTime: string; // HHMMSS
  NonDelReason?: string;
}

// Pickup Request DTOs
export interface IndiaPostDomesticPickupReqDto {
  // Pickup request details - structure to be defined based on technical discussion
  customerDetails?: any;
  pickupAddress?: any;
  contactPerson?: string;
  contactNumber?: string;
  preferredTime?: string;
  articles?: any[];
}

export interface IndiaPostDomesticPickupResDto {
  "Request ID"?: string;
  Status?: string;
  Message?: string;
}

// Routing API DTOs
export interface IndiaPostDomesticRoutingReqDto {
  sourcePin: string;
  destinationPin: string;
}

export interface IndiaPostDomesticRoutingResDto {
  routingData?: any; // Structure to be defined based on API response
}
