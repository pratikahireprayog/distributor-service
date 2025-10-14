// India Post Domestic DoP Integration API Base URLs (as per new documentation)
export enum INDIA_POST_DOMESTIC_BASE_URLS {
  // Test environment base URL
  TEST = "https://test.cept.gov.in",
  // Production environment base URL (when available)
  PRODUCTION = "https://api.cept.gov.in",
}

// India Post Domestic API Endpoints (as per new documentation)
export enum INDIA_POST_DOMESTIC_ENDPOINTS {
  // Authentication APIs
  ACCESS_TOKEN = "/beextcustomer/v1/access/login",
  REFRESH_TOKEN = "/beextcustomer/v1/access/TokenWithRtoken",

  // Tariff APIs
  INTERNATIONAL_TARIFF = "/beextcustomer/v1/international-tariff/calculate",
  PARCEL_TARIFF = "/beextcustomer/v1/parcel-tariff/calculate",
  LETTER_TARIFF = "/beextcustomer/v1/letter-tariff/calculate",
  SPEED_POST_TARIFF = "/beextcustomer/v1/speed-post/tariffs",

  // Pincode Search API
  PINCODE_SEARCH = "/bemasterdata/v1/offices/limited-details",

  // Booking APIs
  BULK_BOOKING_JSON = "/beextcustomer/process-articles",
  BULK_BOOKING_FILE = "/beextcustomer/process-articles-file",

  // Label Generation API
  LABEL_GENERATION = "/beextcustomer/v1/label/create/domestic",

  // Event Sharing API
  EVENT_DOWNLOAD = "/beextcustomer/v1/event/download",

  // Legacy endpoints for backward compatibility
  BULK_BOOKING = "/beextcustomer/process-articles",
  BULK_PICKUP_REQUEST = "/pickupreq/api/createbulkreq",
  CANCEL_PICKUP_REQUEST = "/pickupreq/api/cancel",
  TARIFF_VAS_BULK = "/Tariff_VAS_Bulk/api/values/gettariffVas_Bulk",
  ROUTING = "/Route/api/values/GetRoute",
  OUTBOUND_EVENTS = "/customer/api/BulkCustomer/download",
}

// India Post Domestic Service Types (as per new documentation)
export enum INDIA_POST_DOMESTIC_SERVICE_TYPES {
  SP = "SP", // Speed Post
  BP = "BP", // Business Parcel
  LETTER = "LETTER", // Letter
  PARCEL = "PARCEL", // Parcel
  FGN_LETTER = "FGN_LETTER", // Foreign Letter
  FGN_PARCEL = "FGN_PARCEL", // Foreign Parcel
  EMS = "EMS", // Express Mail Service
}

// India Post Domestic Article Types (as per new documentation)
export enum INDIA_POST_DOMESTIC_ARTICLE_TYPES {
  ROLL = "ROLL", // Roll
  NROL = "NROL", // Non-Roll
  DOC = "DOC", // Document
}

// India Post Domestic Mail Class Codes
export enum INDIA_POST_DOMESTIC_MAIL_CLASS {
  A = "A", // Air
  B = "B", // Surface
  C = "C", // SAL (Surface Air Lifted)
}

// India Post Domestic Transport Types
export enum INDIA_POST_DOMESTIC_TRANSPORT_TYPES {
  AIR = "AIR",
  SAL = "SAL", // Surface Air Lifted
  SURFACE = "SURFACE",
}

// India Post Domestic Booking Types
export enum INDIA_POST_DOMESTIC_BOOKING_TYPES {
  WIC = "WIC", // Walk-in Customer
  BULK = "BULK", // Bulk Customer
}

// India Post Domestic Mail Form Codes
export enum INDIA_POST_DOMESTIC_MAIL_FORMS {
  LB = "LB", // Letter/Box
  PP = "PP", // Packet/Parcel
}

// India Post Domestic Environment Variables
export enum INDIA_POST_DOMESTIC_ENV_VARS {
  // Base URLs
  BASE_URL = "INDIA_POST_DOMESTIC_BASE_URL",

  // Authentication
  USERNAME = "INDIA_POST_DOMESTIC_USERNAME",
  PASSWORD = "INDIA_POST_DOMESTIC_PASSWORD",

  // Customer Details
  CUSTOMER_ID = "INDIA_POST_DOMESTIC_CUSTOMER_ID", // 10 digit customer ID
  BULK_CUSTOMER_ID = "INDIA_POST_DOMESTIC_BULK_CUSTOMER_ID", // 10 digit customer ID (legacy)
  CONTRACT_ID = "INDIA_POST_DOMESTIC_CONTRACT_ID", // 8 digit contract ID
}

// Event Codes for Outbound API (as per new documentation)
export enum INDIA_POST_DOMESTIC_EVENT_CODES {
  IB = "IB", // Item Booked - Booking info + EventCode 'ITEM_BOOK'
  ID = "ID", // Item Delivered - Delivery info + EventCode 'ITEM_DELIVERY'
  LE = "LE", // Last Event - Last scanned event info for each article
  RT = "RT", // Returned - Return-to-sender data with NonDelReason included
}

// Test Parameters for Outbound API (as per new documentation)
export const INDIA_POST_DOMESTIC_TEST_PARAMS = {
  CUSTOMER_ID: "0000000000", // Test Customer ID
  EVENT_ID: "LE", // Test Event ID
  EVENT_DATE_RANGE: {
    START: "01052022", // 01/05/2022 in ddmmyyyy format
    END: "05052022", // 05/05/2022 in ddmmyyyy format
  },
} as const;

// Delivery Instructions (as per new documentation)
export enum INDIA_POST_DOMESTIC_DELIVERY_INSTRUCTIONS {
  ND = "ND", // Normal Delivery
  OD = "OD", // Office Delivery
  SD = "SD", // Self Delivery
}

// Delivery Slots (as per new documentation)
export enum INDIA_POST_DOMESTIC_DELIVERY_SLOTS {
  SLOT_1 = "9am-2pm",
  SLOT_2 = "2pm-5pm",
  SLOT_3 = "5pm-8pm",
}

// RTS Instructions (as per new documentation)
export enum INDIA_POST_DOMESTIC_RTS_INSTRUCTIONS {
  RTS = "RTS", // Return to Sender
  RTA = "RTA", // Return to Address
}

// Prepayment Codes (as per new documentation)
export enum INDIA_POST_DOMESTIC_PREPAYMENT_CODES {
  PS = "PS", // Postage Stamps
  FM = "FM", // Franking Machine
  SS = "SS", // Stamps Sold
}

// COD Types (as per new documentation)
export enum INDIA_POST_DOMESTIC_COD_TYPES {
  COD = "COD", // Cash on Delivery
  CODR = "CODR", // Cash on Delivery Return
}

// Insurance Types (as per new documentation)
export enum INDIA_POST_DOMESTIC_INSURANCE_TYPES {
  DOP = "DOP", // Department of Posts
}
