export const XPRESSBEES_ENV_KEYS = {
  BASE_URL: 'XPRESSBEES_BASE_URL',
  AUTH_PATH: 'XPRESSBEES_AUTH_PATH',
  CREATE_ORDER_PATH: 'XPRESSBEES_CREATE_ORDER_PATH',
  CANCEL_ORDER_PATH: 'XPRESSBEES_CANCEL_ORDER_PATH',
  EMAIL: 'XPRESSBEES_EMAIL',
  PASSWORD: 'XPRESSBEES_PASSWORD',
  COURIER_ID: 'XPRESSBEES_COURIER_ID',
};

export const XPRESSBEES_DEFAULTS = {
  BASE_URL: 'https://ship.xpressbees.com',
  AUTH_PATH: '/api/users/franchise_login',
  CREATE_ORDER_PATH: '/api/franchise/shipments',
  CANCEL_ORDER_PATH: '/api/franchise/shipments/cancel_shipment',
  EMAIL: 'mukesh@cargodham.com',
  PASSWORD: 'Mukesh@3724',
  COURIER_ID: '16948',
};

export const XPRESSBEES_CONSTANTS = {
  TOKEN_REFRESH_BUFFER_SECONDS: 300, // 5 minutes
  DEFAULT_TIMEOUT: 30000,
  PICKUP_LOCATION: 'franchise',
};
