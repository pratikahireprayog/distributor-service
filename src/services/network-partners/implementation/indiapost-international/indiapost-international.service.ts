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
  IndiaPostInternationalBookingReferenceResponseDto,
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

      // Transform payload first to get mail type
      this.logger.log(`[IndiaPost International] Transforming order payload for OrderId: ${orderId}`);
      let primaryMailType = this.getMailTypeCd(orderDetails, delivery.countryCode);
      const alternativeMailTypes = this.getAlternativeMailTypes(primaryMailType, delivery.countryCode);
      const mailTypesToTry = [primaryMailType, ...alternativeMailTypes];

      let lastError: any = null;

      for (const mailTypeCd of mailTypesToTry) {
        try {
          this.logger.log(`[IndiaPost International] Attempting with mail type: ${mailTypeCd} for destination: ${delivery.countryCode}`);
          
          // Get booking reference ID first (required by API)
          this.logger.log(`[IndiaPost International] Fetching booking reference for destination: ${delivery.countryCode}, mailType: ${mailTypeCd}`);
          const bookingRefResult = await this.getBookingReferenceId(mailTypeCd, delivery.countryCode, baseUrl);
          const bookingRefId = bookingRefResult.bookingRefId;
          const productCodeUsed = bookingRefResult.productCode;
          this.logger.log(`[IndiaPost International] Booking reference ID obtained: ${bookingRefId}, Product Code: ${productCodeUsed}`);

          // Transform payload with booking reference ID and mail type
          const payload = this.transformToIndiaPostInternationalPayload(orderDetails, bookingRefId, mailTypeCd);
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
              // Continue to check the response (which is still 403)
            }
          }

          // Check response status
          if (response.status !== 200 && response.status !== 201) {
            const errorResponse = response.data as any;
            const errorMessage = errorResponse?.error?.message 
              || errorResponse?.message 
              || errorResponse?.error 
              || (typeof errorResponse === 'string' ? errorResponse : JSON.stringify(errorResponse));
            
            this.logger.debug(`[IndiaPost International] Error response structure: ${JSON.stringify(errorResponse, null, 2)}`);
            
            // Check if it's the specific "unavailable for country" error
            const isUnavailable = errorMessage?.toLowerCase().includes('unavailable for the country') || 
                                 JSON.stringify(errorResponse)?.toLowerCase().includes('unavailable for the country');
            
            if (isUnavailable && mailTypeCd !== mailTypesToTry[mailTypesToTry.length - 1]) {
              this.logger.warn(`[IndiaPost International] Mail type ${mailTypeCd} is unavailable for this country. Trying alternative...`);
              lastError = { status: response.status, data: response.data, message: errorMessage };
              continue; // Try next mail type
            }

            // If not unavailable or last attempt, fail
            this.logger.error(`[IndiaPost International] API error response - OrderId: ${orderId}, Status: ${response.status}, MailType: ${mailTypeCd}`);
            this.logger.error(`[IndiaPost International] Error response data: ${JSON.stringify(response.data, null, 2)}`);
            
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

          // Success!
          this.logger.log(`[IndiaPost International] Successfully created booking with mail type: ${mailTypeCd}`);
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
        } catch (innerError) {
          this.logger.error(`[IndiaPost International] Attempt with mail type ${mailTypeCd} failed: ${innerError.message}`);
          lastError = innerError;
          // Continue to next mail type
        }
      }

      // If we're here, all mail types failed
      this.logger.error(`[IndiaPost International] All mail type attempts failed for OrderId: ${orderId}`);
      if (lastError && lastError.status) {
        return {
          statusCode: lastError.status,
          message: `IndiaPost International API returned error: ${lastError.message}`,
          partnerCode: PARTNER_CODE_ENUM.INDIA_POST_INTERNATIONAL,
          data: {
            originalResponse: lastError.data,
            shipmentDetails: { trackingDetails: [], documents: [] },
            error: true,
          }
        } as unknown as R;
      }
      throw lastError || new Error('Order creation failed with all available mail types');
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
   * Determines product code based on mail type and destination country
   * Product codes vary based on the mail type (FGN_SP_MERCHANDISE, INTL_APP_EPACKET, etc.)
   * Note: The product code used for booking reference must match what's available for the destination country
   */
  private getProductCode(mailTypeCd: string, destinationCountryCode: string): string {
    // Try multiple product codes - the API will tell us which one is available
    // We'll try them in order of preference
    
    // First, try mail-type specific product codes
    const mailTypeProductCodeMap: Record<string, string[]> = {
      'FGN_SP_MERCHANDISE': ['SP_FGN_MERCHANDISE', 'FGN_SP_MERCHANDISE', 'SP_FGN', 'SP_INTERNATIONAL'], 
      'FGN_SP_DOCUMENT': ['SP_FGN_DOCUMENT', 'FGN_SP_DOCUMENT', 'SP_FGN'],
      'INTL_APP_EPACKET': ['SP_EPACKET', 'INTL_APP_EPACKET', 'SP_ITPS', 'SP_FGN'],
      'FGN_AIR_PARCEL': ['SP_FGN_PARCEL', 'FGN_AIR_PARCEL', 'SP_FGN'],
      'FGN_SMALLPACKETS': ['SP_FGN_SMALLPACKET', 'FGN_SMALLPACKETS', 'SP_FGN'],
      'FGN_LETTER': ['SP_FGN_LETTER', 'FGN_LETTER', 'SP_FGN'],
      'FGN_PRINTEDPAPERS': ['SP_FGN_PRINTED', 'FGN_PRINTEDPAPERS', 'SP_FGN'],
      'FGN_BL': ['SP_FGN_BL', 'FGN_BL', 'SP_FGN'],
      'FGN_BULKBAG': ['SP_FGN_BULKBAG', 'FGN_BULKBAG', 'SP_FGN'],
    };

    // Get product codes to try for this mail type
    const productCodesToTry = mailTypeProductCodeMap[mailTypeCd?.toUpperCase()] || ['SP_FGN', 'SP_INTERNATIONAL', 'SP_EXPORT'];
    
    // Return the first one (we'll try others if this fails)
    return productCodesToTry[0];
  }

  /**
   * Tries multiple product codes to find one that works for the destination country
   */
  private async tryProductCodesForBookingReference(
    mailTypeCd: string,
    destinationCountryCode: string,
    baseUrl: string,
    officeId: string
  ): Promise<{ bookingRefId: string; productCode: string }> {
    const productCodesToTry = this.getProductCodesToTry(mailTypeCd, destinationCountryCode);
    
    for (const productCode of productCodesToTry) {
      try {
        const bookingReferencePath = this.configService.get<string>(
          INDIAPOST_INTERNATIONAL_ENV_KEYS.BOOKING_REFERENCE_PATH,
          INDIAPOST_INTERNATIONAL_DEFAULTS.BOOKING_REFERENCE_PATH
        );
        const url = `${baseUrl}${bookingReferencePath}?office-id=${officeId}&product-code=${productCode}`;

        this.logger.log(`[IndiaPost International] Trying product code: ${productCode} for mailType: ${mailTypeCd}, country: ${destinationCountryCode}`);

        const authHeaders = await this.indiaPostInternationalAuthService.getAuthHeaders();

        const response = await firstValueFrom(
          this.httpService.get<IndiaPostInternationalBookingReferenceResponseDto>(url, {
            headers: authHeaders,
            timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
            validateStatus: () => true,
          })
        );

        if (response.data?.success && response.data?.data?.booking_ref_id) {
          const bookingRefId = response.data.data.booking_ref_id;
          this.logger.log(`[IndiaPost International] Successfully retrieved booking reference ID: ${bookingRefId} using product code: ${productCode}`);
          return { bookingRefId, productCode };
        }
      } catch (error) {
        this.logger.debug(`[IndiaPost International] Product code ${productCode} failed: ${error.message}`);
        // Continue to next product code
      }
    }

    // If all product codes failed, throw error
    throw new CustomHttpException(
      HttpStatus.BAD_REQUEST,
      `IndiaPost International: No valid product code found for mail type '${mailTypeCd}' and country '${destinationCountryCode}'. Tried: ${productCodesToTry.join(', ')}`
    );
  }

  /**
   * Gets list of product codes to try based on mail type and country
   * Based on IndiaPost International API documentation
   * Product codes follow pattern: SP_* for international shipments
   */
  private getProductCodesToTry(mailTypeCd: string, destinationCountryCode: string): string[] {
    const mailTypeProductCodeMap: Record<string, string[]> = {
      'FGN_SP_MERCHANDISE': ['SP_FGN_MERCHANDISE', 'FGN_SP_MERCHANDISE', 'SP_FGN', 'SP_INTERNATIONAL', 'SP_EXPORT'],
      'FGN_SP_DOCUMENT': ['SP_FGN_DOCUMENT', 'FGN_SP_DOCUMENT', 'SP_FGN'],
      'INTL_APP_EPACKET': ['SP_EPACKET', 'INTL_APP_EPACKET', 'SP_ITPS', 'SP_FGN'],
      'FGN_AIR_PARCEL': ['SP_FGN_PARCEL', 'FGN_AIR_PARCEL', 'SP_FGN'],
      'FGN_SMALLPACKETS': ['SP_FGN_SMALLPACKET', 'FGN_SMALLPACKETS', 'SP_FGN'],
      'FGN_LETTER': ['SP_FGN_LETTER', 'FGN_LETTER', 'SP_FGN'],
      'FGN_PRINTEDPAPERS': ['SP_FGN_PRINTED', 'FGN_PRINTEDPAPERS', 'SP_FGN'],
      'FGN_BL': ['SP_FGN_BL', 'FGN_BL', 'SP_FGN'],
      'FGN_BULKBAG': ['SP_FGN_BULKBAG', 'FGN_BULKBAG', 'SP_FGN'],
    };

    // Get mail-type specific codes, or use generic international codes
    const specificCodes = mailTypeProductCodeMap[mailTypeCd?.toUpperCase()];
    if (specificCodes) {
      return specificCodes;
    }

    // Fallback to generic international product codes
    return ['SP_FGN', 'SP_INTERNATIONAL', 'SP_EXPORT', 'SP_INLAND'];
  }

  /**
   * Gets mail type code based on order details
   * Defaults to FGN_SP_MERCHANDISE for international shipments
   * Can be overridden based on destination country or order characteristics
   */
  private getMailTypeCd(order: BaseOrderReqDtoV2, destinationCountryCode?: string): string {
    // Check if mail type is specified in order metadata or other fields
    // For now, default to FGN_SP_MERCHANDISE (International Speed Post Merchandise)
    // This can be made configurable or determined based on order type, weight, etc.
    
    // For certain countries, we might need different mail types
    // This can be expanded based on actual API availability
    const countryMailTypeMap: Record<string, string> = {
      // Add country-specific mail type mappings here if needed
      // 'US': 'INTL_APP_EPACKET', // Example: US might prefer ePacket
    };
    
    if (destinationCountryCode && countryMailTypeMap[destinationCountryCode.toUpperCase()]) {
      return countryMailTypeMap[destinationCountryCode.toUpperCase()];
    }
    
    return 'FGN_SP_MERCHANDISE';
  }

  /**
   * Gets mail class code based on mail type code
   * Based on IndiaPost International API documentation
   */
  private getMailClassCd(mailTypeCd: string): string {
    const mailTypeToMailClassMap: Record<string, string> = {
      'FGN_AIR_PARCEL': 'C',        // International Air Parcel
      'FGN_LETTER': 'U',            // International Registered Letter
      'FGN_SP_DOCUMENT': 'E',       // International Speed Post Document
      'FGN_SP_MERCHANDISE': 'E',    // International Speed Post Document Merchandise
      'FGN_SMALLPACKETS': 'U',      // Registered International Small Packet
      'INTL_APP_EPACKET': 'U',      // International Tracked Packet Service
      'FGN_BL': 'U',                // International Blind Literature
      'FGN_PRINTEDPAPERS': 'U',     // Registered International Printed Papers
      'FGN_BULKBAG': 'U',           // Registered International M Bag
    };
    return mailTypeToMailClassMap[mailTypeCd?.toUpperCase()] || 'C'; // Default to 'C'
  }

  /**
   * Gets alternative mail types to try if the primary one fails
   * Includes all available mail types from IndiaPost International API
   */
  private getAlternativeMailTypes(primaryMailType: string, destinationCountryCode?: string): string[] {
    // Return alternative mail types to try if primary fails
    // Order matters - try most appropriate first
    // Include all mail types from the API documentation
    const allMailTypes = [
      'INTL_APP_EPACKET',      // International Tracked Packet Service (often works for e-commerce)
      'FGN_AIR_PARCEL',        // International Air Parcel
      'FGN_SMALLPACKETS',      // Registered International Small Packet
      'FGN_SP_MERCHANDISE',    // International Speed Post Document Merchandise
      'FGN_SP_DOCUMENT',       // International Speed Post Document
      'FGN_LETTER',            // International Registered Letter
      'FGN_PRINTEDPAPERS',    // Registered International Printed Papers
      'FGN_BL',               // International Blind Literature
      'FGN_BULKBAG',          // Registered International M Bag
    ];
    
    // Remove the primary mail type from alternatives
    const alternatives = allMailTypes.filter(mt => mt !== primaryMailType);
    
    return alternatives;
  }

  /**
   * Gets booking reference ID from IndiaPost API
   * This is required before creating a booking
   * Tries multiple product codes to find one that works for the destination country
   * Returns both booking reference ID and the product code that was used
   */
  private async getBookingReferenceId(
    mailTypeCd: string,
    destinationCountryCode: string,
    baseUrl: string
  ): Promise<{ bookingRefId: string; productCode: string }> {
    try {
      const officeId = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.OFFICE_ID,
        INDIAPOST_INTERNATIONAL_DEFAULTS.OFFICE_ID
      );

      // Try multiple product codes to find one that works
      const result = await this.tryProductCodesForBookingReference(
        mailTypeCd,
        destinationCountryCode,
        baseUrl,
        officeId
      );

      this.logger.log(`[IndiaPost International] Booking reference ID retrieved: ${result.bookingRefId} using product code: ${result.productCode}`);
      return result;
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error;
      }
      this.logger.error(`[IndiaPost International] Failed to get booking reference: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `IndiaPost International: Failed to get booking reference for mail type '${mailTypeCd}' and country '${destinationCountryCode}': ${error.message}`
      );
    }
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

    return isCommercial ? 'RBC' : 'NRCB';
  }

  private transformToIndiaPostInternationalPayload(
    order: BaseOrderReqDtoV2,
    bookingRefId: string,
    mailTypeCd?: string
  ): IndiaPostInternationalCreateOrderRequestDto {
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

    // Get weights - weights are received in grams
    // According to working payload, both physical_weight and charged_weight are in GRAMS as integers
    const physicalWeightRaw = getEffectiveWeight(order.parentShipment || order.childShipments?.[0]);
    const volumetricWeightRaw = parseFloat(String(order.parentShipment?.volumetricWeight || order.childShipments?.[0]?.volumetricWeight || 0));
    
    // physical_weight, volumetric_weight and charged_weight: Integer - in grams
    const physicalWeight = Math.round(physicalWeightRaw);
    const volumetricWeight = Math.round(volumetricWeightRaw);
    const chargedWeight = Math.round(Math.max(physicalWeightRaw, volumetricWeight));

    const dimensions = order.parentShipment?.dimensions || order.childShipments?.[0]?.dimensions || { length: 20, width: 30, height: 10 };
    const length = parseFloat(String((dimensions as any).length || 20));
    const width = parseFloat(String((dimensions as any).width || 30));
    const height = parseFloat(String((dimensions as any).height || 10));

    const items = order.parentShipment?.items || order.childShipments?.[0]?.items || [];
    const articleNumber = String(order.orderId ||order.parentShipment?.awbNumber || order.awbNumber);
    const bookingTypeCd = this.getBookingTypeCd(order);
    
    // Get office ID from config (should match the one used for booking reference)
    const officeIdBkg = parseInt(this.configService.get<string>(
      INDIAPOST_INTERNATIONAL_ENV_KEYS.OFFICE_ID,
      INDIAPOST_INTERNATIONAL_DEFAULTS.OFFICE_ID
    ));

    // Transform sub_pieces from items
    const subPieces: IndiaPostInternationalSubPieceDto[] = items.map((item, index) => {
      // Weight must be integer (no decimals) as per API documentation
      const itemWeight = Math.round(parseFloat(String(item.weight || 0)));
      // Format date as DD-MM-YYYY
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const invoiceDate = `${day}-${month}-${year}`;
      
      const invoiceValueINR = parseFloat(String(item.unitPrice || 0));
      const exchangeRate = 1; // Already in INR
      const FOBExchangeRate = 62.25; // Matching example CAD -> INR
      const fobValueCAD = Math.round((invoiceValueINR / FOBExchangeRate) * 100) / 100;
      
      const hsnCode = String(item.hsnCode || '34011190').replace(/\D/g, '');
      
      return {
        hs_cd: hsnCode,
        cth_cd: hsnCode,
        hs_description: this.sanitizeAddressField(String(item.description || item.name || 'Goods')),
        sp_unit_cd: 'PIECES',
        article_number: articleNumber,
        sp_origin_country_cd: 'IN',
        sp_weight_total: itemWeight || physicalWeight, // Integer in grams
        sp_weight_nett: itemWeight || (physicalWeight > 50 ? physicalWeight - 50 : physicalWeight), 
        sp_invoice_lsn: index + 1,
        sp_invoice_value: invoiceValueINR,
        sp_asbl_fob_value: fobValueCAD, 
        sp_asbl_currency_cd: 'CAD',
        sp_asbl_currency_exchrate: FOBExchangeRate,
        sp_asbl_value_inr: invoiceValueINR,
        sp_origin_currency_cd: 'INR',
        sp_comm_invoice_no: order.referenceId || String(index + 1),
        sp_inv_currency_exchrate: 1,
        sp_count: parseInt(String(item.quantity || 1)),
        sp_comm_invoice_date: invoiceDate,
        sp_tax_invoice_no: order.referenceId || `INV-${index + 1}`,
        sp_tax_invoice_date: invoiceDate,
        sp_inv_currency_cd: 'CAD',
        sp_invoice_value_total: invoiceValueINR,
        channel_type_cd: 'K',
        tax_payment_channel_source: 'other',
        tax_payment_mode_cd: 'oth-c',
        compensation_cess_rate: 0,
        compensation_cess_amount: 0,
        ecommerce_url: 'AMAZON.CA',
        ecommerce_paytranid: order.orderId || 'PayTrans123',
        ecommerce_sku: String(item.sku || 'SKU-001'),
        export_duty_rate: 0,
        export_duty_amount: 0,
        cess_rate: 0,
        cess_amount: 0,
        igst_rate: 0,
        igst_amount: 0,
        created_by: '1352103376',
        office_id_bkg: officeIdBkg,
        ip_address_bkg: '157.245.96.66',
        usertype_cd: 'R',
      };
    });


    // Format phone numbers - alt_contact_no should be 10 digits string, mobile_no should be 10-digit integer
    const senderAltContactNo = this.formatPhoneTo10Digits(pickup.phone, pickup.countryCode);
    const receiverAltContactNo = this.formatPhoneTo10Digits(delivery.phone, delivery.countryCode);
    const senderMobileNo = this.formatPhoneToInteger(pickup.phone, pickup.countryCode);
    const receiverMobileNo = this.formatPhoneToInteger(delivery.phone, delivery.countryCode);

    // Format receiver zipcode
    const receiverZipcode = String(delivery.zip).replace(/\D/g, '');

    return {
      origin: String(pickup.zip),
      iec_code: (order as any).metadata?.iecCode || 'BQHPG9541C',
      sender_pincode: parseInt(pickup.zip),
      destination_ccode: String(delivery.countryCode),
      destination_cname: String(delivery.country),
      mail_type_cd: mailTypeCd || this.getMailTypeCd(order),
      mail_class_cd: this.getMailClassCd(mailTypeCd || this.getMailTypeCd(order)),
      mail_nature_type_cd: '11',
      booking_type_cd: bookingTypeCd,
      bulk_customer_id: 1525065599,
      child_customer_id: 1352103376,
      physical_weight: physicalWeight,
      mail_shape_cd: 'NROL',
      dimension_length: Math.round(length),
      dimension_breadth: Math.round(width),
      dimension_height: Math.round(height),
      volumetric_weight: volumetricWeight,
      charged_weight: chargedWeight,
      declared_value: parseFloat(String(order.payment?.finalAmount || 0)),
      priority_flag: false,
      non_dely_instns_cd: 'P',
      pbe_bank_ref: '',
      upload_doc_inv_count: subPieces.length,
      upload_doc_cert_count: 0,
      upload_doc_lic_count: 0,
      sender_name: this.sanitizeAddressField(String(pickup.name || '')),
      sender_company_name: this.sanitizeAddressField(String((pickup as any).businessName || pickup.name || '')),
      sender_addrline1: this.sanitizeAddressField(String(pickup.street || '')),
      sender_addrline2: this.sanitizeAddressField(String(pickup.landmark || '')),
      sender_addrline3: '',
      sender_city: this.sanitizeAddressField(String(pickup.city || '')),
      sender_state: this.sanitizeAddressField(String(pickup.state || '')),
      sender_country_name: 'India',
      sender_country_code: 'IN',
      sender_email_id: String(pickup.email || ''),
      sender_alt_contact_no: senderAltContactNo,
      sender_kyc_reference: '',
      sender_tax_reference: '0',
      receiver_name: this.sanitizeAddressField(String(delivery.name || '')),
      receiver_company_name: this.sanitizeAddressField(String((delivery as any).businessName || delivery.name || '')),
      receiver_addrline1: this.sanitizeAddressField(String(delivery.street || '')),
      receiver_addrline2: this.sanitizeAddressField(String(delivery.landmark || '')),
      receiver_addrline3: '',
      receiver_city: this.sanitizeAddressField(String(delivery.city || '')),
      receiver_state: this.sanitizeAddressField(String(delivery.state || '')),
      receiver_country: String(delivery.country),
      receiver_country_code: String(delivery.countryCode),
      receiver_zipcode: receiverZipcode,
      receiver_email_id: String(delivery.email || ''),
      receiver_alt_contact_no: receiverAltContactNo,
      receiver_tax_reference: '',
      pbe_type_cd: 'PBE-III',
      declaration1: false,
      declaration2: true,
      declaration3: false,
      declaration4: true,
      selffiling_cusbroker: false,
      article_number: articleNumber,
      bkg_ref_id: bookingRefId,
      created_by: '1352103376',
      office_id_bkg: officeIdBkg,
      origin_office_name: 'Jaipur IBC',
      ip_address_bkg: '157.245.96.66',
      subpiece_count: subPieces.length,
      status_cd: 'BK',
      user_type_cd: 'R',
      channel_type_cd: 'K',
      contract_id: 41819164,
      sender_mobile_no: senderMobileNo,
      receiver_mobile_no: receiverMobileNo,
      sender_gst_no: (order as any).metadata?.senderGstNo || '08BQHPG9541C1ZW',
      bkg_office_gst_no: '',
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

