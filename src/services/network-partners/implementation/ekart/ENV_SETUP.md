# Ekart Environment Variables Setup

## Required Environment Variables

Add the following variables to your `.env` file:

```bash
# Ekart Authentication (MANDATORY)
EKART_USERNAME=C123456
EKART_PASSWORD=your_plain_password_here

# Ekart API Base URLs
EKART_LOGIN_URL=http://103.73.191.220:8080/flipkart/api/customer/login
EKART_CREATE_ORDER_URL=http://103.73.191.220:8080/flipkart/api/customer/order/create
EKART_CANCEL_ORDER_URL=http://103.73.191.220:8080/flipkart/api/customer/order/cancel
EKART_CANCEL_REASONS_URL=http://103.73.191.220:8080/flipkart/api/customer/cancelreasons

# Ekart RSA Public Key (MANDATORY)
# This is the public key used to encrypt passwords before sending to Ekart
# IMPORTANT: Include the full key with BEGIN and END markers on separate lines
EKART_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwh4OSBw4KDBWXL6/ryijo8
FJG51yEIBYZGOVTn2zJs/EPGrh80l0QITyVOmV5667gKJwkcFezUMYS5JsMsPAs7CY
Zaigmd7rsVbfcjHBK4QP3xzfhVP2CHraS8CQptjSIEl2z0yiqHyq1jfNcXR1oyE6HXLS56sq
6d3nVPI+NJrejQOq+TzlJcX9MbvMv0Z8bHA4cBCjOBlOA2+sVHtn2XkN6xe+TVZNFXNi
WiKXCL57a8yGqipswt58EiYDON9l6w1I+xzL+2C9GH7Iq3iFOXMQ4TyEH6utlFoP4T703
HDs41eh3G0/66601tNowxU0X4hWbGMwZRu0ZHkj+3z3TQIDAQAB
-----END PUBLIC KEY-----

# Ekart Customer Configuration (Optional)
EKART_CONSIGNOR_CODE=your_consignor_code
EKART_CONSIGNEE_CODE=your_consignee_code
EKART_DEFAULT_CANCEL_REASON=CC
```

## Important Notes

1. **RSA Public Key Format**: 
   - The `EKART_PUBLIC_KEY` must include the `-----BEGIN PUBLIC KEY-----` and `-----END PUBLIC KEY-----` markers
   - Each line break in the key should be preserved
   - In some environment variable systems, you may need to use `\n` for line breaks

2. **Password Storage**:
   - Store your **plain password** in `EKART_PASSWORD`
   - The service will automatically encrypt it using RSA before sending to Ekart

3. **URLs**:
   - Default URLs are provided but can be overridden
   - Use production URLs for production environment

4. **Testing**:
   - Ensure all mandatory variables are set before testing
   - Missing `EKART_PUBLIC_KEY` will cause startup errors

