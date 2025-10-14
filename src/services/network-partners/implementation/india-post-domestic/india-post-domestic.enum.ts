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

  // Future endpoints will be added here as we integrate more APIs
  // PINCODE_SEARCH = "/pincode/search",
  // TARIFF_CALCULATION = "/tariff/calculate",
  // CREATE_ORDER = "/orders/create",
  // TRACK_ORDER = "/orders/track",
}

// Environment Variables for Configuration
export enum INDIA_POST_DOMESTIC_ENV_VARS {
  // Base URL configuration
  BASE_URL = "INDIA_POST_DOMESTIC_BASE_URL",

  // Authentication credentials - will be updated based on API docs
  USERNAME = "INDIA_POST_DOMESTIC_USERNAME", // May change to CLIENT_ID based on docs
  PASSWORD = "INDIA_POST_DOMESTIC_PASSWORD", // May change to CLIENT_SECRET based on docs

  // Additional config that might be needed
  API_KEY = "INDIA_POST_DOMESTIC_API_KEY", // If API key is required
  CUSTOMER_ID = "INDIA_POST_DOMESTIC_CUSTOMER_ID", // If customer ID is required
}

// Service Types - will be expanded based on API documentation
export enum INDIA_POST_DOMESTIC_SERVICE_TYPES {
  // Placeholder service types - will update with actual services from docs
  SPEED_POST = "SP",
  BUSINESS_PARCEL = "BP",
  REGISTERED_POST = "RP",
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
