// India Post Domestic API Configuration
// Base URLs for different environments
export enum INDIA_POST_DOMESTIC_BASE_URLS {
  // Test environment base URL - will be updated with correct URL from API docs
  TEST = "https://test.cept.gov.in",
  // Production environment base URL - will be updated with correct URL from API docs
  PRODUCTION = "https://api.cept.gov.in",
}

// API Endpoints - Updated with actual API documentation
export enum INDIA_POST_DOMESTIC_ENDPOINTS {
  // Authentication APIs - From API Documentation Section 14.1
  ACCESS_TOKEN = "/beextcustomer/v1/access/login", // Access Token API
  REFRESH_TOKEN = "/beextcustomer/v1/access/TokenWithRtoken", // Token Refresh API

  // Bulk Booking APIs - From API Documentation Section 14.4
  BULK_BOOKING_JSON = "/beextcustomer/process-articles", // JSON payload (up to 1000 articles)
  BULK_BOOKING_FILE = "/beextcustomer/process-articles-file", // File upload (up to 5000 articles)

  // Future endpoints will be added here as we integrate more APIs
  // PINCODE_SEARCH = "/pincode/search",
  // TARIFF_CALCULATION = "/tariff/calculate",
  // TRACK_ORDER = "/orders/track",
}

// Environment Variables for Configuration
export enum INDIA_POST_DOMESTIC_ENV_VARS {
  // Base URL configuration
  BASE_URL = "INDIA_POST_DOMESTIC_BASE_URL",

  // Authentication credentials - will be updated based on API docs
  USERNAME = "INDIA_POST_DOMESTIC_USERNAME", // May change to CLIENT_ID based on docs
  PASSWORD = "INDIA_POST_DOMESTIC_PASSWORD", // May change to CLIENT_SECRET based on docs

  // Bulk Booking Configuration
  CUSTOMER_ID = "INDIA_POST_DOMESTIC_CUSTOMER_ID", // Customer ID for bulk booking
  CONTRACT_ID = "INDIA_POST_DOMESTIC_CONTRACT_ID", // Contract ID for bulk booking

  // Additional config that might be needed
  API_KEY = "INDIA_POST_DOMESTIC_API_KEY", // If API key is required
}

// Service Types - will be expanded based on API documentation
export enum INDIA_POST_DOMESTIC_SERVICE_TYPES {
  // Placeholder service types - will update with actual services from docs
  SPEED_POST = "SP",
  BUSINESS_PARCEL = "BP",
  REGISTERED_POST = "RP",
}

// Article Types for Bulk Booking API
export enum INDIA_POST_DOMESTIC_ARTICLE_TYPES {
  SPEED_POST = "SP", // Speed Post
  BUSINESS_PARCEL = "BP", // Business Parcel
}

// Shape of Article
export enum INDIA_POST_DOMESTIC_SHAPE_TYPES {
  ROLL = "ROLL",
  NON_ROLL = "NROL",
  DOCUMENT = "DOC",
}

// Delivery Instructions
export enum INDIA_POST_DOMESTIC_DELIVERY_INSTRUCTIONS {
  NORMAL_DELIVERY = "ND",
  OFFICE_DELIVERY = "OD",
  SUNDAY_DELIVERY = "SD",
}

// Delivery Slots
export enum INDIA_POST_DOMESTIC_DELIVERY_SLOTS {
  MORNING = "9am-2pm",
  AFTERNOON = "2pm-5pm",
  EVENING = "5pm-8pm",
}

// Return Instructions
export enum INDIA_POST_DOMESTIC_RTS_INSTRUCTIONS {
  RETURN_TO_SENDER = "RTS",
  RETURN_TO_AGENT = "RTA",
}

// Prepayment Codes
export enum INDIA_POST_DOMESTIC_PREPAYMENT_CODES {
  POSTAGE_STAMP = "PS",
  FRANKING_MACHINE = "FM",
  SPEED_POST = "SS",
}

// COD/CODR Types
export enum INDIA_POST_DOMESTIC_COD_TYPES {
  CASH_ON_DELIVERY = "COD",
  CASH_ON_DELIVERY_REGISTERED = "CODR",
}

// Insurance Types
export enum INDIA_POST_DOMESTIC_INSURANCE_TYPES {
  DEPARTMENT_OF_POST = "DOP",
}

// Pickup or Dropoff Types
export enum INDIA_POST_DOMESTIC_PICKUP_DROPOFF {
  PICKUP = "PICKUP",
  DROPOFF = "DROPOFF",
}

// Constants for token management
export const INDIA_POST_DOMESTIC_CONFIG = {
  // Token expiry buffer (5 minutes before actual expiry)
  TOKEN_EXPIRY_BUFFER_SECONDS: 300,

  // Default token expiry if not provided in response (1 hour)
  DEFAULT_TOKEN_EXPIRY_SECONDS: 3600,

  // HTTP timeout for API calls
  HTTP_TIMEOUT_MS: 30000,
} as const;
