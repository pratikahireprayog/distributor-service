export const URBANBOLT_API_URLS = {
  BASE_URL: "https://uat.urbanebolt.in/api/v1",
  AUTH_TOKEN: "/auth/getToken/",
  CREATE_MANIFEST: "/services/manifest/",
} as const;

export const URBANBOLT_AUTH_CONFIG = {
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
  CUSTOMER_CODE: "UEBCUS0008",
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
