import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { INetworkPartner } from '../../interfaces/network-partner.interface';
import { BaseOrderResDto, BaseResDto, ManifestReqDto } from 'src/common/dtos/base.dto';
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from 'src/common/dtos/base2.dto';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { IndiaPostInternationalAuthService } from './indiapost-international-auth.service';
import {
  IndiaPostInternationalCreateOrderRequestDto,
  IndiaPostInternationalCreateOrderResponseDto,
  IndiaPostInternationalSubPieceDto,
  IndiaPostInternationalCreateLabelRequestDto,
  IndiaPostInternationalCreateLabelResponseDto,
} from './indiapost-international.dto';
import {
  INDIAPOST_INTERNATIONAL_ENV_KEYS,
  INDIAPOST_INTERNATIONAL_DEFAULTS,
  INDIAPOST_INTERNATIONAL_CONSTANTS,
} from './indiapost-international-constants';

@Injectable()
export class IndiaPostInternationalService implements INetworkPartner {
  protected readonly logger = new Logger(IndiaPostInternationalService.name);

  constructor(
    private readonly indiaPostInternationalAuthService: IndiaPostInternationalAuthService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    const startTime = Date.now();
    const orderId = orderDetails.orderId;
    const awbNumber = orderDetails.parentShipment?.awbNumber || orderDetails.awbNumber || orderId;
    
    try {
      this.logger.log(`[IndiaPost International] Starting order creation - OrderId: ${orderId}, AWB: ${awbNumber}`);
      this.logger.log(`[IndiaPost International] Order details - PartnerCode: ${partnerCode}, DocumentType: ${orderDetails.documentType}`);

      // Validate required fields
      if (!orderDetails || !orderDetails.addresses) {
        this.logger.error(`[IndiaPost International] Validation failed - Missing order details or addresses for OrderId: ${orderId}`);
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Order details and addresses are required'
        );
      }

      const pickup = orderDetails.addresses.find((a) => a.type === 'PICKUP');
      const delivery = orderDetails.addresses.find((a) => a.type === 'DELIVERY');
      this.logger.log(`[IndiaPost International] Addresses found - Pickup: ${pickup?.city || 'N/A'}, Delivery: ${delivery?.city || 'N/A'} (${delivery?.countryCode || 'N/A'})`);

      const baseUrl = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BASE_URL,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.CREATE_ORDER_PATH,
        INDIAPOST_INTERNATIONAL_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;

      this.logger.log(`[IndiaPost International] API Configuration - BaseURL: ${baseUrl}, Path: ${createOrderPath}`);
      this.logger.log(`[IndiaPost International] Full API URL: ${url}`);

      // Transform payload
      this.logger.log(`[IndiaPost International] Transforming order payload for OrderId: ${orderId}`);
      const payload = this.transformToIndiaPostInternationalPayload(orderDetails);
      const payloadJson = JSON.stringify(payload);
      this.logger.log(`[IndiaPost International] Payload transformed : ${payloadJson}`);
      this.logger.log(`[IndiaPost International] Payload summary - BookingType: ${payload.booking_type_cd}, Weight: ${payload.physical_weight}g, DeclaredValue: ${payload.declared_value}`);

      // Get authentication headers
      this.logger.log(`[IndiaPost International] Retrieving authentication headers for OrderId: ${orderId}`);
      let authHeaders = await this.indiaPostInternationalAuthService.getAuthHeaders();
      const hasAuth = !!authHeaders.Authorization;
      const authTokenPreview = hasAuth ? `${authHeaders.Authorization.substring(0, 20)}...` : 'MISSING';
      this.logger.log(`[IndiaPost International] Auth headers retrieved - HasToken: ${hasAuth}, Preview: ${authTokenPreview}`);

      this.logger.log(`[IndiaPost International] Making API request - OrderId: ${orderId}, URL: ${url}`);
      this.logger.log(`[IndiaPost International] Request payload (full): ${JSON.stringify(payload, null, 2)}`);

      let response = await firstValueFrom(
        this.httpService.post<IndiaPostInternationalCreateOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      const requestDuration = Date.now() - startTime;
      this.logger.log(`[IndiaPost International] API response received - OrderId: ${orderId}, Status: ${response.status}, Duration: ${requestDuration}ms`);

      // Handle 403 Forbidden - might be expired token, try refreshing once
      if (response.status === 403) {
        this.logger.warn(`[IndiaPost International] Received 403 Forbidden for OrderId: ${orderId} - Attempting token refresh`);
        this.logger.warn(`[IndiaPost International] Response data: ${JSON.stringify(response.data, null, 2)}`);
        
        try {
          // Force token refresh
          this.logger.log(`[IndiaPost International] Forcing token refresh for OrderId: ${orderId}`);
          await this.indiaPostInternationalAuthService.refreshToken();
          
          // Get fresh auth headers
          authHeaders = await this.indiaPostInternationalAuthService.getAuthHeaders();
          const newAuthTokenPreview = authHeaders.Authorization ? `${authHeaders.Authorization.substring(0, 20)}...` : 'MISSING';
          this.logger.log(`[IndiaPost International] New token obtained - Preview: ${newAuthTokenPreview}`);
          
          // Retry the request
          const retryStartTime = Date.now();
          this.logger.log(`[IndiaPost International] Retrying API request - OrderId: ${orderId}, URL: ${url}`);
          response = await firstValueFrom(
            this.httpService.post<IndiaPostInternationalCreateOrderResponseDto>(url, payload, {
              headers: authHeaders,
              timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
              validateStatus: () => true,
              maxContentLength: Infinity as unknown as number,
              maxBodyLength: Infinity as unknown as number,
            })
          );
          const retryDuration = Date.now() - retryStartTime;
          this.logger.log(`[IndiaPost International] Retry response - OrderId: ${orderId}, Status: ${response.status}, Duration: ${retryDuration}ms`);
        } catch (refreshError) {
          this.logger.error(`[IndiaPost International] Token refresh failed for OrderId: ${orderId} - Error: ${refreshError.message}`);
          this.logger.error(`[IndiaPost International] Token refresh error stack: ${refreshError.stack}`);
          // Continue to return the original 403 error
        }
      }

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`[IndiaPost International] API error response - OrderId: ${orderId}, Status: ${response.status}`);
        this.logger.error(`[IndiaPost International] Error response data: ${JSON.stringify(response.data, null, 2)}`);
        this.logger.error(`[IndiaPost International] Request URL: ${url}`);
        this.logger.error(`[IndiaPost International] Request payload: ${JSON.stringify(payload, null, 2)}`);
        this.logger.error(`[IndiaPost International] Response headers: ${JSON.stringify(response.headers, null, 2)}`);
        this.logger.error(`[IndiaPost International] Total request duration: ${Date.now() - startTime}ms`);
        
        // Handle error response - API might return different structure for errors
        const errorResponse = response.data as any;
        const errorMessage = errorResponse?.message || errorResponse?.error || JSON.stringify(response.data);
        
        this.logger.error(`[IndiaPost International] Error message extracted: ${errorMessage}`);
        
        return {
          statusCode: response.status,
          message: `IndiaPost International API returned error: ${errorMessage}`,
          partnerCode: PARTNER_CODE_ENUM.INDIA_POST_INTERNATIONAL,
          data: {
            originalResponse: response.data,
            requestUrl: url,
            requestBody: payload,
            responseHeaders: response.headers,
            shipmentDetails: {
              trackingDetails: [],
              documents: [],
            },
            error: true,
          },
        } as unknown as R;
      }

      const responseData = response.data;
      this.logger.log(`[IndiaPost International] Success response received - OrderId: ${orderId}`);
      this.logger.log(`[IndiaPost International] Response data: ${JSON.stringify(responseData, null, 2)}`);

      // Extract partner AWB number (pbe_no) from Article object
      const partnerAwbNumber = responseData?.data?.Article?.pbe_no 
        ? String(responseData.data.Article.pbe_no) 
        : '';

      // Create label after successful order creation
      let labelUrl = responseData?.data?.label_url || '';
      let labelContent = '';
      let labelFormat = 'url';

      try {
        this.logger.log(`[IndiaPost International] Creating label for OrderId: ${orderId}`);
        const labelResponse = await this.createLabel();
        
        if (labelResponse?.data?.label_url) {
          labelUrl = labelResponse.data.label_url;
          labelContent = labelUrl;
          labelFormat = 'url';
          this.logger.log(`[IndiaPost International] Label created successfully - OrderId: ${orderId}, LabelURL: ${labelUrl}`);
        } else if (labelResponse?.data?.label) {
          labelContent = labelResponse.data.label;
          labelFormat = 'base64';
          this.logger.log(`[IndiaPost International] Label created successfully - OrderId: ${orderId}, Label format: base64`);
        } else if (labelResponse?.data?.label_base64) {
          labelContent = labelResponse.data.label_base64;
          labelFormat = 'base64';
          this.logger.log(`[IndiaPost International] Label created successfully - OrderId: ${orderId}, Label format: base64`);
        } else {
          this.logger.warn(`[IndiaPost International] Label creation response did not contain expected label data - OrderId: ${orderId}`);
          this.logger.warn(`[IndiaPost International] Label response: ${JSON.stringify(labelResponse, null, 2)}`);
        }
      } catch (labelError) {
        this.logger.error(`[IndiaPost International] Label creation failed - OrderId: ${orderId}, Error: ${labelError.message}`);
        this.logger.error(`[IndiaPost International] Label creation error stack: ${labelError.stack}`);
        // Continue with order creation response even if label creation fails
        // Use label URL from order creation response if available
        if (!labelUrl && responseData?.data?.label_url) {
          labelUrl = responseData.data.label_url;
          labelContent = labelUrl;
        }
      }

      this.logger.log(`[IndiaPost International] Order created successfully - OrderId: ${orderId}, PartnerAWB: ${partnerAwbNumber}, LabelURL: ${labelUrl || 'N/A'}`);
      this.logger.log(`[IndiaPost International] Total processing time: ${Date.now() - startTime}ms`);

      // Build documents array - include label if available
      const documents = [];
      if (labelContent) {
        documents.push({
          content: labelContent,
          type: 'label',
          format: labelFormat,
        });
      }

      return {
        statusCode: 200,
        message: 'Order created successfully with IndiaPost International',
        partnerCode: PARTNER_CODE_ENUM.INDIA_POST_INTERNATIONAL,
        data: {
          originalResponse: responseData,
          requestUrl: url,
          requestBody: payload,
          shipmentDetails: {
            trackingDetails: [
              {
                awbNumber: awbNumber,
                partnerAwbNumber: partnerAwbNumber,
                partnerName: PARTNER_CODE_ENUM.INDIA_POST_INTERNATIONAL,
                transporterId: 'INDIA_POST_INTERNATIONAL',
              },
            ],
            documents: documents,
          },
        },
      } as unknown as R;
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`[IndiaPost International] createOrderV2 failed - OrderId: ${orderId}, Duration: ${totalDuration}ms`);
      this.logger.error(`[IndiaPost International] Error message: ${error.message}`);
      this.logger.error(`[IndiaPost International] Error stack: ${error.stack}`);
      
      if (error.response) {
        this.logger.error(`[IndiaPost International] Error response status: ${error.response.status}`);
        this.logger.error(`[IndiaPost International] Error response data: ${JSON.stringify(error.response.data, null, 2)}`);
        this.logger.error(`[IndiaPost International] Error response headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      }
      
      if (error.request) {
        this.logger.error(`[IndiaPost International] Request config: ${JSON.stringify({
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        }, null, 2)}`);
      }
      
      const baseUrl = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BASE_URL,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.CREATE_ORDER_PATH,
        INDIAPOST_INTERNATIONAL_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;
      
      this.logger.error(`[IndiaPost International] Request URL: ${url}`);
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `IndiaPost International createOrderV2 failed: ${error.message}`,
        {
          requestUrl: url,
          error: error.message,
          stack: error.stack,
        }
      );
    }
  }

  /**
   * Creates a shipping label for IndiaPost International
   * This endpoint is specifically designed for generating labels associated with international application e-packets
   */
  private async createLabel(): Promise<IndiaPostInternationalCreateLabelResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`[IndiaPost International] Starting label creation`);
      
      const baseUrl = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BASE_URL,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BASE_URL
      );
      const createLabelPath = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.CREATE_LABEL_PATH,
        INDIAPOST_INTERNATIONAL_DEFAULTS.CREATE_LABEL_PATH
      );
      const url = `${baseUrl}${createLabelPath}`;

      this.logger.log(`[IndiaPost International] Label API Configuration - BaseURL: ${baseUrl}, Path: ${createLabelPath}`);
      this.logger.log(`[IndiaPost International] Full Label API URL: ${url}`);

      // Prepare label creation payload
      const labelPayload: IndiaPostInternationalCreateLabelRequestDto = {
        office_customer: 'CUSTOMER',
        article_type: 'INTL_APP_EPACKET',
      };

      this.logger.log(`[IndiaPost International] Label creation payload: ${JSON.stringify(labelPayload, null, 2)}`);

      // Get authentication headers
      this.logger.log(`[IndiaPost International] Retrieving authentication headers for label creation`);
      let authHeaders = await this.indiaPostInternationalAuthService.getAuthHeaders();
      const hasAuth = !!authHeaders.Authorization;
      const authTokenPreview = hasAuth ? `${authHeaders.Authorization.substring(0, 20)}...` : 'MISSING';
      this.logger.log(`[IndiaPost International] Auth headers retrieved - HasToken: ${hasAuth}, Preview: ${authTokenPreview}`);

      this.logger.log(`[IndiaPost International] Making label creation API request - URL: ${url}`);
      
      let response = await firstValueFrom(
        this.httpService.post<IndiaPostInternationalCreateLabelResponseDto>(url, labelPayload, {
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      const requestDuration = Date.now() - startTime;
      this.logger.log(`[IndiaPost International] Label API response received - Status: ${response.status}, Duration: ${requestDuration}ms`);

      // Handle 403 Forbidden - might be expired token, try refreshing once
      if (response.status === 403) {
        this.logger.warn(`[IndiaPost International] Received 403 Forbidden for label creation - Attempting token refresh`);
        this.logger.warn(`[IndiaPost International] Response data: ${JSON.stringify(response.data, null, 2)}`);
        
        try {
          // Force token refresh
          this.logger.log(`[IndiaPost International] Forcing token refresh for label creation`);
          await this.indiaPostInternationalAuthService.refreshToken();
          
          // Get fresh auth headers
          authHeaders = await this.indiaPostInternationalAuthService.getAuthHeaders();
          const newAuthTokenPreview = authHeaders.Authorization ? `${authHeaders.Authorization.substring(0, 20)}...` : 'MISSING';
          this.logger.log(`[IndiaPost International] New token obtained - Preview: ${newAuthTokenPreview}`);
          
          // Retry the request
          const retryStartTime = Date.now();
          this.logger.log(`[IndiaPost International] Retrying label creation API request - URL: ${url}`);
          response = await firstValueFrom(
            this.httpService.post<IndiaPostInternationalCreateLabelResponseDto>(url, labelPayload, {
              headers: {
                ...authHeaders,
                'Content-Type': 'application/json',
              },
              timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
              validateStatus: () => true,
              maxContentLength: Infinity as unknown as number,
              maxBodyLength: Infinity as unknown as number,
            })
          );
          const retryDuration = Date.now() - retryStartTime;
          this.logger.log(`[IndiaPost International] Retry response - Status: ${response.status}, Duration: ${retryDuration}ms`);
        } catch (refreshError) {
          this.logger.error(`[IndiaPost International] Token refresh failed for label creation - Error: ${refreshError.message}`);
          this.logger.error(`[IndiaPost International] Token refresh error stack: ${refreshError.stack}`);
          // Continue to return the original 403 error
        }
      }

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`[IndiaPost International] Label API error response - Status: ${response.status}`);
        this.logger.error(`[IndiaPost International] Error response data: ${JSON.stringify(response.data, null, 2)}`);
        this.logger.error(`[IndiaPost International] Request URL: ${url}`);
        this.logger.error(`[IndiaPost International] Request payload: ${JSON.stringify(labelPayload, null, 2)}`);
        this.logger.error(`[IndiaPost International] Response headers: ${JSON.stringify(response.headers, null, 2)}`);
        this.logger.error(`[IndiaPost International] Total request duration: ${Date.now() - startTime}ms`);
        
        // Handle error response
        const errorResponse = response.data as any;
        const errorMessage = errorResponse?.message || errorResponse?.error || JSON.stringify(response.data);
        
        this.logger.error(`[IndiaPost International] Error message extracted: ${errorMessage}`);
        
        throw new CustomHttpException(
          response.status,
          `IndiaPost International Label API returned error: ${errorMessage}`
        );
      }

      const responseData = response.data;
      this.logger.log(`[IndiaPost International] Label creation success response received`);
      this.logger.log(`[IndiaPost International] Label response data: ${JSON.stringify(responseData, null, 2)}`);
      this.logger.log(`[IndiaPost International] Total label creation processing time: ${Date.now() - startTime}ms`);

      return responseData;
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`[IndiaPost International] createLabel failed - Duration: ${totalDuration}ms`);
      this.logger.error(`[IndiaPost International] Error message: ${error.message}`);
      this.logger.error(`[IndiaPost International] Error stack: ${error.stack}`);
      
      if (error.response) {
        this.logger.error(`[IndiaPost International] Error response status: ${error.response.status}`);
        this.logger.error(`[IndiaPost International] Error response data: ${JSON.stringify(error.response.data, null, 2)}`);
        this.logger.error(`[IndiaPost International] Error response headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      }
      
      if (error.request) {
        this.logger.error(`[IndiaPost International] Request config: ${JSON.stringify({
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        }, null, 2)}`);
      }
      
      const baseUrl = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BASE_URL,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BASE_URL
      );
      const createLabelPath = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.CREATE_LABEL_PATH,
        INDIAPOST_INTERNATIONAL_DEFAULTS.CREATE_LABEL_PATH
      );
      const url = `${baseUrl}${createLabelPath}`;
      
      this.logger.error(`[IndiaPost International] Request URL: ${url}`);
      
      throw error;
    }
  }

  /**
   * Sanitizes address fields by removing special characters except allowed ones
   * Allowed special characters: dash, asterisk, slash, exclamation, at, hash, dollar, percent, caret, ampersand
   * Uses Unicode character-set for English language
   */
  private sanitizeAddressField(value: string): string {
    if (!value) return '';
    // Remove all special characters except -*/!@#$%^&
    // Allow alphanumeric, spaces, and the specified special characters
    // Note: - must be escaped or placed at the end of character class
    return String(value)
      .replace(/[^\w\s*/!@#$%^&\-]/g, '')
      .trim();
  }

  /**
   * Formats phone number to 10 digits only (for alt_contact_no fields)
   * Removes country code, ISD prefix, and ensures exactly 10 digits
   */
  private formatPhoneTo10Digits(phone: string, countryCode: string = 'IN'): string {
    if (!phone) return '7607858569'; // Default Indian number

    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Map common country codes
    const countryCodeMap: { [key: string]: string } = {
      IN: '91',
      US: '1',
      GB: '44',
      AU: '61',
      CA: '1',
      DE: '49',
      FR: '33',
      IT: '39',
      ES: '34',
      JP: '81',
      CN: '86',
      KR: '82',
      BR: '55',
      MX: '52',
      RU: '7',
    };

    const isdCode = countryCodeMap[countryCode] || '91';

    // Remove ISD prefix (00)
    if (digits.startsWith('00')) {
      digits = digits.substring(2);
    }

    // If phone starts with country code, remove it
    if (digits.startsWith(isdCode)) {
      digits = digits.substring(isdCode.length);
    }

    // If phone starts with 0, remove it (local format)
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }

    // Take last 10 digits (or pad/truncate to 10)
    if (digits.length > 10) {
      digits = digits.substring(digits.length - 10);
    } else if (digits.length < 10) {
      digits = digits.padStart(10, '0');
    }

    return digits;
  }

  /**
   * Formats phone number to integer (for mobile_no fields)
   * Returns 10-digit integer without country code
   */
  private formatPhoneToInteger(phone: string, countryCode: string = 'IN'): number {
    const digits = this.formatPhoneTo10Digits(phone, countryCode);
    return parseInt(digits, 10);
  }

  /**
   * Formats phone number to ISD format with 00 prefix
   * Max 21 digits (inclusive of ISD Code)
   * Note: This is kept for backward compatibility but not used in current payload
   */
  private formatPhoneToISD(phone: string, countryCode: string = 'IN'): string {
    if (!phone) return '00917607858569'; // Default Indian number

    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Map common country codes
    const countryCodeMap: { [key: string]: string } = {
      IN: '91',
      US: '1',
      GB: '44',
      AU: '61',
      CA: '1',
      DE: '49',
      FR: '33',
      IT: '39',
      ES: '34',
      JP: '81',
      CN: '86',
      KR: '82',
      BR: '55',
      MX: '52',
      RU: '7',
    };

    const isdCode = countryCodeMap[countryCode] || '91';

    // If phone starts with country code, remove it
    if (digits.startsWith(isdCode)) {
      digits = digits.substring(isdCode.length);
    }

    // If phone starts with 0, remove it (local format)
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }

    // Construct ISD format: 00 + country code + phone number
    const isdFormatted = `00${isdCode}${digits}`;

    // Ensure max 21 digits
    if (isdFormatted.length > 21) {
      return isdFormatted.substring(0, 21);
    }

    return isdFormatted;
  }

  /**
   * Converts weight to GRAMS without decimals (for volumetric_weight and charged_weight)
   */
  private convertWeightToGrams(weight: number, unit: string = 'kg'): number {
    if (!weight || weight <= 0) return 500; // Default 500 grams

    let weightInGrams = weight;

    // Convert to grams if needed
    if (unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'kilogram') {
      weightInGrams = weight * 1000;
    } else if (unit.toLowerCase() === 'g' || unit.toLowerCase() === 'gram' || unit.toLowerCase() === 'grams') {
      weightInGrams = weight;
    }

    // Round to integer (no decimals)
    return Math.round(weightInGrams);
  }

  /**
   * Converts weight to KG with 3 decimal places (for physical_weight)
   * Returns as number with 3 decimal precision
   */
  private convertWeightToKgDecimal(weight: number, unit: string = 'kg'): number {
    if (!weight || weight <= 0) return 0.500; // Default 0.500 kg

    let weightInKg = weight;

    // Convert to kg if needed
    if (unit.toLowerCase() === 'g' || unit.toLowerCase() === 'gram' || unit.toLowerCase() === 'grams') {
      weightInKg = weight / 1000;
    } else if (unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'kilogram') {
      weightInKg = weight;
    }

    // Round to 3 decimal places
    return Math.round(weightInKg * 1000) / 1000;
  }

  /**
   * Enforces string field length by truncating or padding
   * @param value - The string value
   * @param minLength - Minimum length (if 0, no padding)
   * @param maxLength - Maximum length (truncates if exceeded, 0 means no limit)
   * @returns Formatted string
   */
  private enforceStringLength(value: string, minLength: number, maxLength: number): string {
    if (!value) {
      // If minLength is 0 and maxLength is 0, return empty string (optional field)
      if (minLength === 0 && maxLength === 0) {
        return '';
      }
      // Return empty string or default based on minLength
      return minLength > 0 ? ' '.repeat(minLength) : '';
    }

    let result = String(value);

    // Truncate if exceeds maxLength (only if maxLength > 0)
    if (maxLength > 0 && result.length > maxLength) {
      result = result.substring(0, maxLength);
    }

    // Pad if below minLength (only if minLength > 0)
    if (minLength > 0 && result.length < minLength) {
      result = result.padEnd(minLength, ' ');
    }

    return result;
  }

  /**
   * Determines booking_type_cd based on order type
   * RCB for commercial articles, NRCB for non-commercial
   */
  private getBookingTypeCd(order: BaseOrderReqDtoV2): string {
    // Check if order is commercial based on documentType or orderType
    const isCommercial =
      order.documentType?.toUpperCase() === 'COMMERCIAL' ||
      order.parcelCategory?.toUpperCase() === 'COMMERCIAL' ||
      order.orderType?.toUpperCase() === 'COMMERCIAL';

    return isCommercial ? 'RCB' : 'NRCB';
  }

  private transformToIndiaPostInternationalPayload(order: BaseOrderReqDtoV2): IndiaPostInternationalCreateOrderRequestDto {
    const pickup = order.addresses.find((a) => a.type === 'PICKUP');
    const delivery = order.addresses.find((a) => a.type === 'DELIVERY');

    if (!pickup || !delivery) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'Both pickup and delivery addresses are required'
      );
    }

    // Helper function to get effective weight
    const getEffectiveWeight = (shipment: any): number => {
      const physicalWeight = parseFloat(String(shipment?.physicalWeight || 0));
      const volumetricWeight = parseFloat(String(shipment?.volumetricWeight || 0));
      return physicalWeight > 0 ? physicalWeight : (volumetricWeight || 500);
    };

    // Get weights - physical_weight should be in kg with 3 decimals, others in grams
    const physicalWeightRaw = getEffectiveWeight(order.parentShipment || order.childShipments?.[0]);
    const volumetricWeightRaw = parseFloat(String(order.parentShipment?.volumetricWeight || order.childShipments?.[0]?.volumetricWeight || 0.6));
    
    // physical_weight: Numeric(10,3) - in kg with 3 decimal places
    const physicalWeight = this.convertWeightToKgDecimal(physicalWeightRaw, 'kg');
    // volumetric_weight and charged_weight: Integer - in grams
    const volumetricWeight = this.convertWeightToGrams(volumetricWeightRaw, 'kg');
    const chargedWeight = Math.max(this.convertWeightToGrams(physicalWeightRaw, 'kg'), volumetricWeight);

    const dimensions = order.parentShipment?.dimensions || order.childShipments?.[0]?.dimensions || { length: 20, width: 30, height: 10 };
    const length = parseFloat(String((dimensions as any).length || 20));
    const width = parseFloat(String((dimensions as any).width || 30));
    const height = parseFloat(String((dimensions as any).height || 10));

    const items = order.parentShipment?.items || order.childShipments?.[0]?.items || [];
    const articleNumber = String(order.parentShipment?.awbNumber || order.awbNumber || order.orderId);
    const bookingTypeCd = this.getBookingTypeCd(order);

    // Transform sub_pieces from items
    const subPieces: IndiaPostInternationalSubPieceDto[] = items.map((item, index) => {
      const itemWeight = this.convertWeightToGrams(parseFloat(String(item.weight || 500)), 'kg');
      // Format date as DD-MM-YYYY
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const invoiceDate = `${day}-${month}-${year}`;
      const invoiceValue = parseFloat(String(item.unitPrice || 700));
      const hsnCode = String(item.hsnCode || '44219090');
      
      return {
        hs_cd: this.enforceStringLength(hsnCode, 7, 7),
        cth_cd: this.enforceStringLength(hsnCode, 8, 8),
        hs_description: this.enforceStringLength(this.sanitizeAddressField(String(item.description || item.name || 'Product')), 14, 14),
        sp_unit_cd: this.enforceStringLength('PIECES', 7, 7),
        article_number: this.enforceStringLength(articleNumber, 13, 13),
        sp_origin_country_cd: this.enforceStringLength('IN', 3, 3),
        sp_weight_total: itemWeight,
        sp_weight_nett: itemWeight,
        sp_invoice_lsn: 123,
        sp_invoice_value: Math.round(invoiceValue),
        sp_asbl_fob_value: Math.round(invoiceValue),
        sp_asbl_currency_cd: this.enforceStringLength('US', 2, 2),
        sp_asbl_currency_exchrate: 2,
        sp_asbl_value_inr: Math.round(invoiceValue * 75),
        sp_origin_currency_cd: this.enforceStringLength('INR', 3, 3),
        sp_comm_invoice_no: this.enforceStringLength(String(index + 1), 2, 2),
        sp_inv_currency_exchrate: 75,
        sp_count: parseInt(String(item.quantity || 1)),
        sp_comm_invoice_date: this.enforceStringLength(invoiceDate, 10, 10),
        sp_tax_invoice_no: this.enforceStringLength(`INV-${index + 1}`, 5, 5),
        sp_tax_invoice_date: this.enforceStringLength(invoiceDate, 10, 10),
        sp_inv_currency_cd: this.enforceStringLength('USD', 3, 3),
        sp_invoice_value_total: Math.round(invoiceValue),
        channel_type_cd: this.enforceStringLength('I', 1, 1),
        tax_payment_channel_source: this.enforceStringLength('other', 5, 5),
        tax_payment_mode_cd: this.enforceStringLength('TC', 2, 2),
        compensation_cess_rate: 0,
        compensation_cess_amount: 0,
        ecommerce_url: this.enforceStringLength('https://ecommerce.example.com', 29, 29),
        ecommerce_paytranid: this.enforceStringLength('PayTrans123', 11, 11),
        ecommerce_sku: this.enforceStringLength(String(item.sku || 'SKU123'), 6, 6),
        export_duty_rate: 0,
        export_duty_amount: 0,
        cess_rate: 0,
        cess_amount: 0,
        igst_rate: 0,
        igst_amount: 0,
        created_by: this.enforceStringLength('10256468', 8, 8),
        office_id_bkg: 90001,
        ip_address_bkg: this.enforceStringLength('192.168.1.1', 11, 11),
        usertype_cd: this.enforceStringLength('I', 1, 1),
      };
    });

    // If no items, create a default sub_piece
    if (subPieces.length === 0) {
      const defaultWeight = this.convertWeightToGrams(500, 'kg');
      // Format date as DD-MM-YYYY
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const invoiceDate = `${day}-${month}-${year}`;
      
      subPieces.push({
        hs_cd: this.enforceStringLength('44219090', 7, 7),
        cth_cd: this.enforceStringLength('44219090', 8, 8),
        hs_description: this.enforceStringLength('Product', 14, 14),
        sp_unit_cd: this.enforceStringLength('PIECES', 7, 7),
        article_number: this.enforceStringLength(articleNumber, 13, 13),
        sp_origin_country_cd: this.enforceStringLength('IN', 3, 3),
        sp_weight_total: defaultWeight,
        sp_weight_nett: defaultWeight,
        sp_invoice_lsn: 123,
        sp_invoice_value: 400,
        sp_asbl_fob_value: 400,
        sp_asbl_currency_cd: this.enforceStringLength('US', 2, 2),
        sp_asbl_currency_exchrate: 2,
        sp_asbl_value_inr: 1800,
        sp_origin_currency_cd: this.enforceStringLength('INR', 3, 3),
        sp_comm_invoice_no: this.enforceStringLength('23', 2, 2),
        sp_inv_currency_exchrate: 75,
        sp_count: 1,
        sp_comm_invoice_date: this.enforceStringLength(invoiceDate, 10, 10),
        sp_tax_invoice_no: this.enforceStringLength('12356', 5, 5),
        sp_tax_invoice_date: this.enforceStringLength(invoiceDate, 10, 10),
        sp_inv_currency_cd: this.enforceStringLength('USD', 3, 3),
        sp_invoice_value_total: 5343,
        channel_type_cd: this.enforceStringLength('I', 1, 1),
        tax_payment_channel_source: this.enforceStringLength('other', 5, 5),
        tax_payment_mode_cd: this.enforceStringLength('TC', 2, 2),
        compensation_cess_rate: 3232,
        compensation_cess_amount: 323,
        ecommerce_url: this.enforceStringLength('https://ecommerce.example.com', 29, 29),
        ecommerce_paytranid: this.enforceStringLength('PayTrans123', 11, 11),
        ecommerce_sku: this.enforceStringLength('SKU123', 6, 6),
        export_duty_rate: 10,
        export_duty_amount: 50,
        cess_rate: 5,
        cess_amount: 25,
        igst_rate: 15,
        igst_amount: 75,
        created_by: this.enforceStringLength('10256468', 8, 8),
        office_id_bkg: 90001,
        ip_address_bkg: this.enforceStringLength('192.168.1.1', 11, 11),
        usertype_cd: this.enforceStringLength('I', 1, 1),
      });
    }

    // Format phone numbers - alt_contact_no should be 10 digits string, mobile_no should be 10-digit integer
    const senderAltContactNo = this.formatPhoneTo10Digits(pickup.phone || '7607858569', pickup.countryCode || 'IN');
    const receiverAltContactNo = this.formatPhoneTo10Digits(delivery.phone || '9876543210', delivery.countryCode || 'US');
    const senderMobileNo = this.formatPhoneToInteger(pickup.phone || '7607858569', pickup.countryCode || 'IN');
    const receiverMobileNo = this.formatPhoneToInteger(delivery.phone || '9876543210', delivery.countryCode || 'US');

    // Format pincode - must be exactly 6 digits
    const senderPincodeStr = String(pickup.zip || '226010').replace(/\D/g, '');
    const senderPincode = senderPincodeStr.length === 6 ? parseInt(senderPincodeStr, 10) : 226010;

    // Format receiver zipcode - must be exactly 5 digits (US format)
    const receiverZipcode = this.enforceStringLength(String(delivery.zip || '54321').replace(/\D/g, ''), 5, 5);

    return {
      iec_code: this.enforceStringLength('23232', 1, 50),
      sender_pincode: senderPincode,
      destination_ccode: this.enforceStringLength(String(delivery.countryCode || 'US'), 2, 2),
      destination_cname: this.enforceStringLength(String(delivery.country || 'United States'), 1, 50),
      mail_type_cd: this.enforceStringLength('FGN_SP_MERCHANDISE', 1, 30),
      mail_class_cd: this.enforceStringLength('C', 1, 15),
      mail_nature_type_cd: this.enforceStringLength('11', 3, 3),
      booking_type_cd: bookingTypeCd,
      bulk_customer_id: 1000000001,
      child_customer_id: 1000000002,
      physical_weight: physicalWeight,
      mail_shape_cd: this.enforceStringLength('NROL', 4, 4),
      dimension_length: Math.round(length),
      dimension_breadth: Math.round(width),
      dimension_height: Math.round(height),
      volumetric_weight: volumetricWeight,
      charged_weight: chargedWeight,
      declared_value: Math.round(parseFloat(String(order.payment?.finalAmount || 400))),
      priority_flag: true,
      non_dely_instns_cd: this.enforceStringLength('A', 1, 1),
      upload_doc_inv_count: 0,
      upload_doc_cert_count: 0,
      upload_doc_lic_count: 0,
      sender_name: this.enforceStringLength(this.sanitizeAddressField(String(pickup.name || 'Sender Name')), 12, 12),
      sender_company_name: this.enforceStringLength(this.sanitizeAddressField(String(pickup.name || 'My Company')), 1, 255),
      sender_addrline1: this.enforceStringLength(this.sanitizeAddressField(String(pickup.street || 'Sender Addr 01')), 12, 12),
      sender_addrline2: this.enforceStringLength(this.sanitizeAddressField(String(pickup.landmark || 'Sender Addr 02')), 12, 12),
      sender_addrline3: this.enforceStringLength(this.sanitizeAddressField(String(pickup.state || 'Sender Addr 03')), 12, 12),
      sender_city: this.enforceStringLength(this.sanitizeAddressField(String(pickup.city || 'Lucknow')), 7, 7),
      sender_state: this.enforceStringLength(this.sanitizeAddressField(String(pickup.state || 'UP')), 2, 2),
      sender_country_name: this.enforceStringLength('India', 1, 255),
      sender_country_code: this.enforceStringLength('IN', 2, 2),
      sender_email_id: this.enforceStringLength(String(pickup.email || 'sender@example.com'), 19, 19),
      sender_alt_contact_no: this.enforceStringLength(senderAltContactNo, 10, 10),
      sender_kyc_reference: this.enforceStringLength('CFUPR34343E', 11, 11),
      sender_tax_reference: this.enforceStringLength('034349347343242', 15, 15),
      receiver_name: this.enforceStringLength(this.sanitizeAddressField(String(delivery.name || 'Receiver Name')), 9, 9),
      receiver_company_name: this.enforceStringLength(this.sanitizeAddressField(String(delivery.name || '')), 0, 0),
      receiver_addrline1: this.enforceStringLength(this.sanitizeAddressField(String(delivery.street || 'Receiver Line 1')), 16, 16),
      receiver_addrline2: this.enforceStringLength(this.sanitizeAddressField(String(delivery.landmark || 'Receiver Line 2')), 15, 15),
      receiver_addrline3: this.enforceStringLength(this.sanitizeAddressField(String(delivery.state || 'Receiver Line 3')), 15, 15),
      receiver_city: this.enforceStringLength(this.sanitizeAddressField(String(delivery.city || 'Ohio')), 4, 4),
      receiver_state: this.enforceStringLength(this.sanitizeAddressField(String(delivery.state || 'Oregon')), 6, 6),
      receiver_country: this.enforceStringLength(String(delivery.country || 'United States'), 1, 50),
      receiver_country_code: this.enforceStringLength(String(delivery.countryCode || 'US'), 2, 2),
      receiver_zipcode: receiverZipcode,
      receiver_email_id: this.enforceStringLength(String(delivery.email || 'receiver@example.com'), 20, 20),
      receiver_alt_contact_no: this.enforceStringLength(receiverAltContactNo, 10, 10),
      receiver_kyc_reference: this.enforceStringLength('KYC321', 6, 6),
      receiver_tax_reference: this.enforceStringLength('TaxRef321', 9, 9),
      pbe_type_cd: this.enforceStringLength('PBE-III', 1, 10),
      pbe_bank_ref: this.enforceStringLength('Ref34343', 1, 50),
      declaration1: true,
      declaration2: true,
      declaration3: true,
      declaration4: true,
      selffiling_cusbroker: false,
      cus_broker_lic_no: this.enforceStringLength('Lic123', 6, 6),
      cus_broker_name: this.enforceStringLength('Customs Broker Name', 19, 19),
      cus_broker_address: this.enforceStringLength('Customs Address', 15, 15),
      article_number: this.enforceStringLength(articleNumber, 13, 13),
      bkg_ref_id: this.enforceStringLength(String(order.orderId), 13, 13),
      created_by: this.enforceStringLength('10256468', 8, 8),
      office_id_bkg: 21260721,
      origin_office_name: this.enforceStringLength('Vrindavan SO', 12, 12),
      ip_address_bkg: this.enforceStringLength('192.168.0.1', 11, 11),
      subpiece_count: subPieces.length,
      status_cd: this.enforceStringLength('IC', 2, 2),
      user_type_cd: this.enforceStringLength('R', 1, 1),
      channel_type_cd: this.enforceStringLength('K', 1, 1),
      contract_id: 10000001,
      sender_mobile_no: senderMobileNo,
      receiver_mobile_no: receiverMobileNo,
      bkg_office_gst_no: this.enforceStringLength('feafea', 6, 6),
      sender_gst_no: this.enforceStringLength('fefe', 4, 4),
      sub_pieces: subPieces,
    };
  }

  // Stub implementations for other INetworkPartner methods
  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async createOrder<T, R>(orderDetails: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Use createOrderV2 for IndiaPost International');
  }

  async getOrderDetails<T, R>(params: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async cancelOrder<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Use cancelOrderV2 for IndiaPost International');
  }

  async updateOrderV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async createPickup<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async createPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async cancelPickup<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async cancelPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async reattemptDeliveryV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async pushOrderToDRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async pushOrdersToPRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async pushOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async manifestOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async updateEcomOrderWebhook<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async pushOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async updateOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async updatePartnerToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }
}

