/**
 * Environment variable keys for DPWORLD configuration
 */
export const DPWORLD_ENV_KEYS = {
  BASE_URL: 'DPWORLD_BASE_URL',
  API_KEY: 'DPWORLD_API_KEY',
  ORG_TOKEN: 'DPWORLD_ORG_TOKEN',
  CREATE_ORDER_PATH: 'DPWORLD_CREATE_ORDER_PATH',
} as const;

/**
 * Default values for DPWORLD configuration
 */
export const DPWORLD_DEFAULTS = {
  BASE_URL: 'https://connect.cargoes.com',
  CREATE_ORDER_PATH: '/flow/api/public_tracking/v1/createShipments',
} as const;

/**
 * DPWORLD API constants
 */
export const DPWORLD_CONSTANTS = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  UPLOAD_TYPE: 'FORM_BY_AWB_NUMBER',
} as const;

