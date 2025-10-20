// Environment variable keys for UrbanBolt configuration
export const URBANBOLT_ENV_KEYS = {
  BASE_URL: 'URBANBOLT_BASE_URL',
  AUTH_TOKEN_PATH: 'URBANBOLT_AUTH_TOKEN_PATH',
  CREATE_MANIFEST_PATH: 'URBANBOLT_CREATE_MANIFEST_PATH',
  USERNAME: 'URBANBOLT_USERNAME',
  PASSWORD: 'URBANBOLT_PASSWORD',
} as const;

// Default values if environment variables are not set
export const URBANBOLT_DEFAULTS = {
  BASE_URL: "https://uat.urbanebolt.in/api/v1",
  AUTH_TOKEN_PATH: "/auth/getToken/",
  CREATE_MANIFEST_PATH: "/services/manifest/",
  USERNAME: "info@urbanebolt.com",
  PASSWORD: "EKIcygsLVV5RCtPZ",
} as const;

export const URBANBOLT_SERVICE_TYPES = {
  SDD: "SDD", // Same Day Delivery
  NDD: "NDD", // Next Day Delivery
} as const;

export const URBANBOLT_PAY_MODES = {
  PPD: "PPD", // Prepaid
  COD: "COD", // Cash on Delivery
} as const;

export const URBANBOLT_ADDRESS_TYPES = {
  HOME: "Home",
  OFFICE: "Office",
  WAREHOUSE: "Warehouse",
} as const;

export const URBANBOLT_DEFAULT_VALUES = {
  CUSTOMER_CODE: "UBC0180",
  COUNTRY: "India",
  DECLARED_VALUE: 100.00,
  COLLECTABLE_VALUE: 0.00,
  PIECES: 1,
  WEIGHT: 0.5,
  LENGTH: 10,
  BREADTH: 10,
  HEIGHT: 10,
  VOL_WEIGHT: 0.5,
} as const;
