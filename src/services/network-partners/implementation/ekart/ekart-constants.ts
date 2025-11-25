// Ekart Environment Keys
export const EKART_ENV_KEYS = {
  BASE_URL: 'EKART_BASE_URL',
  AUTH_USERNAME: 'EKART_AUTH_USERNAME',
  AUTH_PASSWORD: 'EKART_AUTH_PASSWORD',
  AUTH_PATH: 'EKART_AUTH_PATH',
  CREATE_ORDER_PATH: 'EKART_CREATE_ORDER_PATH',
  CANCEL_ORDER_PATH: 'EKART_CANCEL_ORDER_PATH',
};

// Ekart Default Values
export const EKART_DEFAULTS = {
  BASE_URL: 'https://ekart.apptmyz.com',
  AUTH_PATH: '/flipkart/api/customer/login',
  CREATE_ORDER_PATH: '/flipkart/api/customer/order/create',
  CANCEL_ORDER_PATH: '/flipkart/api/customer/order/cancel',
};

// Ekart Constants
export const EKART_CONSTANTS = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  TOKEN_EXPIRY_BUFFER: 300000, // 5 minutes buffer before token expires
};


