export const NAQEL_API_URL = 'https://infotrack.naqelexpress.com/NaqelAPIServices/NaqelAPIDemo/9.0/XMLShippingService.asmx';

export const NAQEL_SOAP_ACTIONS = {
  CREATE_BOOKING: 'http://tempuri.org/CreateBooking',
  CANCEL_BOOKING: 'http://tempuri.org/CancelBooking',
  CREATE_WAYBILL: 'http://tempuri.org/CreateWaybillAlt',
};

export const NAQEL_CLIENT_INFO = {
  ClientID: '100', // replace with actual ID
  Password: 'string', // replace with actual password
  Version: '9.0', // as per WSDL
};

export const NAQEL_HEADERS = {
  'Content-Type': 'text/xml; charset=utf-8',
};

export const CITYCODE_CURRENCY_MAPPING = [
  { "ID": 1,  "code": "SAR", "name": "Saudi Riyal" },
  { "ID": 2,  "code": "AED", "name": "UAE Dirham" },
  { "ID": 4,  "code": "USD", "name": "American Dollar" },
  { "ID": 5,  "code": "GBP", "name": "British Pound Sterling" },
  { "ID": 6,  "code": "OMR", "name": "Omani Riyal" },
  { "ID": 7,  "code": "JOD", "name": "Jordanian Dinar" },
  { "ID": 8,  "code": "LBP", "name": "Lebanese Pound" },
  { "ID": 9,  "code": "BHD", "name": "Bahraini Dinar" },
  { "ID": 10, "code": "EGP", "name": "Egyptian Pound" },
  { "ID": 11, "code": "KWD", "name": "Kuwaiti Dinar" },
  { "ID": 12, "code": "CNY", "name": "Yuan (Ren Min Bi)" },
  { "ID": 13, "code": "TRY", "name": "Turkish Lira" },
  { "ID": 15, "code": "HKD", "name": "Hong Kong Dollar" },
  { "ID": 16, "code": "EUR", "name": "Euro" },
  { "ID": 27, "code": "IQD", "name": "Iraqi Dinar" },
  { "ID": 28, "code": "MAD", "name": "Moroccan Dirham" },
  { "ID": 29, "code": "KRW", "name": "South Korean Won" },
  { "ID": 30, "code": "DZD", "name": "Algerian Dinar" },
  { "ID": 31, "code": "TND", "name": "Tunisian Dinar" },
  { "ID": 32, "code": "AUD", "name": "Australian Dollar" },
  { "ID": 33, "code": "ILS", "name": "Israel Dollar" },
  { "ID": 34, "code": "QAR", "name": "Qatari Rial" }
]
