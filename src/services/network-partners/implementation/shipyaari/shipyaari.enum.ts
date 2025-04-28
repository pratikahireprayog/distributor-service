/**
 * Enum for Shipyaari API endpoints
 */
export enum SHIPYAARI_ENDPOINTS {
  CREATE_ORDER = "/createOrder",
  CREATE_MANIFEST = "/manifestPdf",
  CANCEL_ORDER = "/cancelShipment",
}

/**
 * Enum for Shipyaari environments
 */
export enum SHIPYAARI_ENV {
  BASE_URL = "BASE_URL",
  USERNAME = "USERNAME",
  PASSWORD = "PASSWORD",
  API_KEY = "API_KEY",
  CLIENT_ID = "CLIENT_ID",
}

/**
 * Env variable names for Shipyaari config
 */
export enum SHIPYAARI_ENV_VARS {
  BASE_URL = "SHIPYAARI_BASE_URL",
  USERNAME = "SHIPYAARI_EMAIL",
  PASSWORD = "SHIPYAARI_PASSWORD",
  API_KEY = "SHIPYAARI_API_KEY",
  CLIENT_ID = "SHIPYAARI_CLIENT_ID",
}

/**
 * Order status mappings for Shipyaari
 */
export enum SHIPYAARI_ORDER_STATUS {
  CREATED = "created",
  CANCELLED = "cancelled",
}

/**
 * Payment type mapping for Shipyaari
 */
export enum SHIPYAARI_PAYMENT_TYPE {
  COD = "COD",
  PREPAID = "PREPAID",
}
