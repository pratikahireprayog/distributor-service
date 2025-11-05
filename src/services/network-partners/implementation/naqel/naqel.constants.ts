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
