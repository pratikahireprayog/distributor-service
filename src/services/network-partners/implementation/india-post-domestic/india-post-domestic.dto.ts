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

// Access Token Request DTO - Based on API Documentation Section 14.1.1
export interface IndiaPostDomesticAccessTokenReqDto {
  username: string; // The unique identifier for the user, typically a phone number or user ID
  password: string; // The user's password for authentication
}

// Access Token Response DTO - Based on API Documentation Section 14.1.1
export interface IndiaPostDomesticAccessTokenResDto {
  success: boolean; // Indicates whether the login was successful
  message: string; // A message providing additional information (may be empty)
  data: {
    access_token: string; // The token used to access protected resources
    refresh_token: string; // The token used to obtain a new access token when the current one expires
    id_token: string; // A token that contains user identity information
    expires_in: number; // The duration in seconds until the access token expires
    refresh_expires_in: number; // The duration in seconds until the refresh token expires
  };
}

// Refresh Token Request DTO - Based on API Documentation Section 14.1.2
// Note: The refresh token is sent as Bearer token in Authorization header
// AND also as form-urlencoded in body (as per the example)
export interface IndiaPostDomesticRefreshTokenReqDto {
  refreshToken: string; // The refresh token value sent as form-urlencoded
}

// Refresh Token Response DTO - Based on API Documentation Section 14.1.2
export interface IndiaPostDomesticRefreshTokenResDto {
  access_token: string; // A new access token that can be used for subsequent API calls
  expires_in: number; // The duration (in seconds) until the access token expires
  token_type: string; // The type of token returned (usually "Bearer")
}

// ================================
// FUTURE DTOs (Placeholders for upcoming integrations)
// ================================

// These will be implemented as we add more APIs

// Pincode Search DTOs
export interface IndiaPostDomesticPincodeSearchReqDto extends BaseReqDto {
  pincode: string;
}

export interface IndiaPostDomesticPincodeSearchResDto extends BaseResDto {
  pincode?: string;
  serviceable?: boolean;
  office_name?: string;
  district?: string;
  state?: string;
}

// Order Creation DTOs (extending base DTOs)
export interface IndiaPostDomesticCreateOrderReqDto extends BaseOrderReqDto {
  // Will be populated with India Post specific fields
  service_type?: string;
  article_type?: string;
  declared_value?: number;
}

export interface IndiaPostDomesticCreateOrderResDto extends BaseOrderResDto {
  // Will be populated with India Post specific response fields
  article_number?: string;
  barcode?: string;
  booking_id?: string;
}

// Tracking DTOs
export interface IndiaPostDomesticTrackingReqDto extends BaseReqDto {
  article_number: string;
}

export interface IndiaPostDomesticTrackingResDto extends BaseResDto {
  article_number?: string;
  current_status?: string;
  delivery_date?: string;
  tracking_events?: Array<{
    event_date?: string;
    event_time?: string;
    event_description?: string;
    location?: string;
  }>;
}

// Tariff Calculation DTOs
export interface IndiaPostDomesticTariffReqDto extends BaseReqDto {
  service_type: string;
  source_pincode: string;
  destination_pincode: string;
  weight: number; // in grams
  length?: number; // in cm
  breadth?: number; // in cm
  height?: number; // in cm
  declared_value?: number;
}

export interface IndiaPostDomesticTariffResDto extends BaseResDto {
  base_tariff?: number;
  fuel_surcharge?: number;
  service_tax?: number;
  total_amount?: number;
  currency?: string;
  chargeable_weight?: number;
}

// Manifest DTOs
export interface IndiaPostDomesticManifestReqDto extends ManifestReqDto {
  // Will be populated with India Post specific manifest fields
  manifest_date?: string;
  office_code?: string;
}

export interface IndiaPostDomesticManifestResDto extends BaseResDto {
  manifest_id?: string;
  manifest_number?: string;
  total_articles?: number;
  total_weight?: number;
}

// Cancel Order DTOs
export interface IndiaPostDomesticCancelOrderReqDto extends BaseCancelOrderDto {
  // Will be populated with India Post specific cancellation fields
  article_number: string;
  cancellation_reason?: string;
}

export interface IndiaPostDomesticCancelOrderResDto extends BaseResDto {
  article_number?: string;
  cancellation_status?: string;
  refund_amount?: number;
}

// ================================
// BULK BOOKING API DTOs
// ================================

/**
 * Article data for bulk booking
 * Based on API Documentation Section 14.4
 */
export interface IndiaPostDomesticArticleDto {
  // Basic Article Information
  bulk_customer_id: string; // Mandatory, Number Length 10
  contract_id: string; // Mandatory, Number Length 8
  barcode_no?: string; // Optional, Characters 13
  pickup_or_dropoff: string; // Required: "PICKUP" or "DROPOFF"
  article_type: "SP" | "BP"; // Mandatory: SP (Speed Post) or BP (Business Parcel)

  // Physical Properties
  physical_weight: number; // Mandatory, Number Length 3,3 (grams)
  shape_of_article?: "ROLL" | "NROL" | "DOC"; // Optional
  length?: number; // Optional, Max 100
  breadth_diameter?: number; // Optional, Max 100
  height?: number; // Optional, Max 100

  // Delivery Instructions
  priority_flag?: boolean; // Optional
  delivery_instruction?: "ND" | "OD" | "SD"; // Optional
  delivery_slot?: "9am-2pm" | "2pm-5pm" | "5pm-8pm"; // Optional
  instruction_rts?: "RTS" | "RTA"; // Optional

  // Sender Information
  sender_name: string; // Mandatory, Characters 80
  sender_company: string; // Mandatory, Characters 80
  sender_add_line_1: string; // Mandatory, Characters 80
  sender_add_line_2?: string; // Optional, Characters 80
  sender_city: string; // Mandatory, Characters 80
  sender_state?: string; // Optional, Characters 80
  sender_pincode: string; // Mandatory, Number 6
  sender_emailid?: string; // Optional, Characters 80
  sender_alt_contact?: string; // Optional, Numbers 10
  sender_kyc?: string; // Optional, Characters 20
  sender_tax_reference?: string; // Optional, Characters 20
  sender_mobile_no: string; // Mandatory, Numbers 10

  // Receiver Information
  receiver_name: string; // Mandatory, Characters 80
  receiver_company: string; // Mandatory, Characters 80
  receiver_add_line_1: string; // Mandatory, Characters 80
  receiver_add_line_2?: string; // Optional, Characters 80
  receiver_city: string; // Mandatory, Characters 80
  receiver_state?: string; // Optional, Characters 80
  receiver_pincode: string; // Mandatory, Number 6
  receiver_emailid?: string; // Optional, Characters 80
  receiver_alt_contact?: string; // Optional, Numbers 10
  receiver_kyc?: string; // Optional, Characters 20
  receiver_tax_reference?: string; // Optional, Characters 20
  receiver_mobile_no: string; // Mandatory, Numbers 10

  // Address Flags and Dropoff
  alt_address_flag: boolean; // Mandatory
  pickup_address_flag: boolean; // Mandatory
  drop_off_pincode: string; // Mandatory, Number 6

  // Payment and Services
  prepayment_code?: "PS" | "FM" | "SS"; // Optional
  value_of_prepayment?: number; // Optional, Length 10,2
  codr_cod: "COD" | "CODR"; // Mandatory
  value_for_codr_cod: number; // Mandatory, Length 10,2
  insurance_type?: "DOP"; // Optional
  value_of_insurance?: number; // Optional, Length 10,2
  ack?: boolean; // Optional
  bulk_reference: string; // Mandatory, Characters 50

  // Pickup Address Information
  pickup_address_id?: number; // Optional, Number 8
  pickup_addressee_name: string; // Mandatory, Characters 80
  pickup_company_name: string; // Mandatory, Characters 80
  pickup_address_line1: string; // Mandatory, Characters 80
  pickup_address_line2?: string; // Optional, Characters 80
  pickup_address_line3?: string; // Optional, Characters 80
  pickup_city: string; // Mandatory, Characters 80
  pickup_state?: string; // Optional, Characters 80
  pickup_pincode: string; // Mandatory, Number 6
  pickup_email_id?: string; // Optional, Characters 80
  pickup_alt_contact_no?: string; // Optional, Numbers 10
  pickup_mobile_no: string; // Mandatory, Numbers 10
  pickup_schedule_slot?: string; // Optional, Time slots like "08:00-09:00"
  pickup_schedule_date?: string; // Optional, dd-mm-yyyy format

  // Alternative Address Information
  alt_addressee_name: string; // Mandatory, Characters 80
  alt_company_name: string; // Mandatory, Characters 80
  alt_address_line1: string; // Mandatory, Characters 80
  alt_address_line2?: string; // Optional, Characters 80
  alt_address_line3?: string; // Optional, Characters 80
  alt_city: string; // Mandatory, Characters 80
  alt_state?: string; // Optional, Characters 80
  alt_pincode: string; // Mandatory, Number 6
  alt_email_id?: string; // Optional, Characters 80
  alt_contact_no?: string; // Optional, Numbers 10
  alt_alternate_mobile_no: string; // Mandatory, Numbers 10
}

/**
 * Bulk Booking Request DTO (JSON endpoint)
 */
export interface IndiaPostDomesticBulkBookingReqDto {
  articles: IndiaPostDomesticArticleDto[];
}

/**
 * Valid article in response
 */
export interface IndiaPostDomesticValidArticleDto {
  barcode_no: string;
  index: number;
  timestamp: string;
  offset_number: string;
  block_number: number;
  calculated_tariff: number;
  currency: string;
}

/**
 * Error article in response
 */
export interface IndiaPostDomesticErrorArticleDto {
  barcode_no: string;
  index: number;
  timestamp: string;
  offset_number: null;
  block_number: null;
  errors: string[];
}

/**
 * Response summary
 */
export interface IndiaPostDomesticBookingSummaryDto {
  success_count: number;
  error_count: number;
  total_tariff_amount: number;
}

/**
 * Bulk Booking Response DTO
 */
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
  valid_articles: IndiaPostDomesticValidArticleDto[];
  error_articles: IndiaPostDomesticErrorArticleDto[];
  summary: IndiaPostDomesticBookingSummaryDto;
}

/**
 * Bulk Booking Error Response DTO
 */
export interface IndiaPostDomesticBulkBookingErrorResDto {
  success: false;
  message: string;
  errors?: Array<{
    type: string;
    msg: string;
    path: string;
    location: string;
  }>;
  timestamp: string;
  custom_id?: string;
}
