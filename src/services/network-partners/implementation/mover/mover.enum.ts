/**
 * Environment variable keys for Mover configuration
 */
export const MOVER_ENV_KEYS = {
  BASE_URL: "MOVER_BASE_URL",
  ESTIMATE_ORDER_URL: "MOVER_ESTIMATE_ORDER_URL",
  CREATE_ORDER_URL: "MOVER_CREATE_ORDER_URL",
  CANCEL_ORDER_URL: "MOVER_CANCEL_ORDER_URL",
  USERNAME: "MOVER_USERNAME",
  PASSWORD: "MOVER_PASSWORD",
  VEHICLE_ID: "MOVER_VEHICLE_ID",
  GOODS_TYPE_ID: "MOVER_GOODS_TYPE_ID",
} as const;

/**
 * Default values for Mover configuration
 */
export const MOVER_DEFAULTS = {
  BASE_URL: "https://api.boxnmove.com",
  ESTIMATE_ORDER_URL: "https://api.boxnmove.com/business/order-estimate",
  CREATE_ORDER_URL: "https://api.boxnmove.com/business/book-vehicle",
  CANCEL_ORDER_URL: "https://api.boxnmove.com/business/cancel-order",
  VEHICLE_ID: 5,
  GOODS_TYPE_ID: 1,
} as const;

