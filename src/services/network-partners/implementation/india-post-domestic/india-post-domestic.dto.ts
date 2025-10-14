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
