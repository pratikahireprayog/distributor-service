import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { INetworkPartner } from '../../interfaces/network-partner.interface';
import { BaseOrderResDto, BaseResDto, ManifestReqDto } from 'src/common/dtos/base.dto';
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from 'src/common/dtos/base2.dto';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { StandardRequestDto } from 'src/services/distributor/distributor.service';
import { IndiaPostInternationalAuthService } from './indiapost-international-auth.service';
import {
  IndiaPostInternationalCreateOrderRequestDto,
  IndiaPostInternationalCreateOrderResponseDto,
  IndiaPostInternationalSubPieceDto,
  IndiaPostInternationalBookingReferenceResponseDto,
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

      const baseUrl = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BASE_URL,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.CREATE_ORDER_PATH,
        INDIAPOST_INTERNATIONAL_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;

      // Get destination country code (now async, fetches from geo-location API if needed)
      const destinationCountryCodeResult = await this.getDestinationCountryCode(delivery, orderDetails);
      const destinationCountryCode = destinationCountryCodeResult.countryCode;
      
      // Get mail type and booking reference
      const mailTypeCd = this.getMailTypeCd(orderDetails, destinationCountryCode);
      
      // Get booking reference ID first (required by API)
      const bookingRefResult = await this.getBookingReferenceId(mailTypeCd, destinationCountryCode, baseUrl);
      const bookingRefId = bookingRefResult.bookingRefId;

      // Transform payload with booking reference ID, mail type, and destination country code
      const payload = this.transformToIndiaPostInternationalPayload(orderDetails, bookingRefId, mailTypeCd, destinationCountryCode);

      // Get authentication headers
      let authHeaders = await this.indiaPostInternationalAuthService.getAuthHeaders();

      let response = await firstValueFrom(
        this.httpService.post<IndiaPostInternationalCreateOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Handle 403 Forbidden - might be expired token, try refreshing once
      if (response.status === 403) {
        this.logger.warn(`[IndiaPost International] Received 403 Forbidden - Attempting token refresh`);
        try {
          await this.indiaPostInternationalAuthService.refreshToken();
          authHeaders = await this.indiaPostInternationalAuthService.getAuthHeaders();
          response = await firstValueFrom(
            this.httpService.post<IndiaPostInternationalCreateOrderResponseDto>(url, payload, {
              headers: authHeaders,
              timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
              validateStatus: () => true,
              maxContentLength: Infinity as unknown as number,
              maxBodyLength: Infinity as unknown as number,
            })
          );
        } catch (refreshError) {
          this.logger.error(`[IndiaPost International] Token refresh failed: ${refreshError.message}`);
        }
      }

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        const errorResponse = response.data as any;
        const errorMessage = errorResponse?.error?.message 
          || errorResponse?.message 
          || errorResponse?.error 
          || (typeof errorResponse === 'string' ? errorResponse : JSON.stringify(errorResponse));
        
        this.logger.error(`[IndiaPost International] API error - OrderId: ${orderId}, Status: ${response.status}, Error: ${errorMessage}`);
        
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

      // Success
      const responseData = response.data;
      const partnerAwbNumber = responseData?.data?.Article?.pbe_no 
        ? String(responseData.data.Article.pbe_no) 
        : '';
      const articleNumber = responseData?.data?.Article?.article_number || '';
      const responseBookingRefId = responseData?.data?.Article?.bkg_ref_id || '';

      // Generate label after successful order creation
      const documents: any[] = [];
      try {
        // First, check if label URL is already in the response
        const labelUrl = responseData?.data?.label_url || '';
        if (labelUrl) {
          documents.push({
            content: labelUrl,
            type: 'label',
            format: 'url',
          });
        } else {
          // If no label URL in response, try to generate label using label creation API
          const childCustomerId = this.configService.get<string>(
            INDIAPOST_INTERNATIONAL_ENV_KEYS.CHILD_CUSTOMER_ID,
            INDIAPOST_INTERNATIONAL_DEFAULTS.CHILD_CUSTOMER_ID
          );
          const bulkCustomerId = this.configService.get<string>(
            INDIAPOST_INTERNATIONAL_ENV_KEYS.BULK_CUSTOMER_ID,
            INDIAPOST_INTERNATIONAL_DEFAULTS.BULK_CUSTOMER_ID
          );
          
          // Use booking reference ID for label generation (required by API)
          if (responseBookingRefId) {
            // Try child_customer_id first, then bulk_customer_id if it fails
            let labelData = await this.generateLabel(
              responseBookingRefId,
              childCustomerId
            );
            
            if (!labelData) {
              labelData = await this.generateLabel(
                responseBookingRefId,
                bulkCustomerId
              );
            }
            
            // If still no label, try with article number instead of booking ref
            if (!labelData && articleNumber) {
              labelData = await this.generateLabel(
                articleNumber,
                childCustomerId
              );
            }
            
            if (labelData) {
              // Prefer base64 image if available (from label API response)
              if (labelData.label_base64) {
                documents.push({
                  content: labelData.label_base64,
                  type: 'label',
                  format: 'base64',
                  barcode: labelData.label_barcode,
                });
              } else if (labelData.label_url) {
                documents.push({
                  content: labelData.label_url,
                  type: 'label',
                  format: 'url',
                  barcode: labelData.label_barcode,
                });
              }
            }
          }
        }
      } catch (labelError) {
        this.logger.error(`[IndiaPost International] Label generation failed: ${labelError.message}`);
        // Continue without label - don't fail the order creation
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
   * Gets product code - hardcoded to SP_INLAND as per sample payload
   */
  private getProductCode(mailTypeCd: string): string {
    return 'SP_INLAND';
  }

  /**
   * Gets country code from delivery address
   * First tries to fetch from delivery address fields or metadata
   * Falls back to geo-location API using postal code, or default values
   * Returns both the country code and its source for validation purposes
   */
  private async getDestinationCountryCode(delivery: any, order: any): Promise<{ countryCode: string; source: 'explicit' | 'metadata' | 'geoLocation' | 'default' }> {
    // First, try to get from delivery address fields (explicit)
    if (delivery?.countryCode) {
      return { countryCode: delivery.countryCode, source: 'explicit' };
    }
    if (delivery?.country) {
      // Try to normalize country name to code
      const countryCode = this.getCountryCodeFromName(delivery.country);
      if (countryCode) {
        return { countryCode, source: 'explicit' };
      }
      return { countryCode: delivery.country, source: 'explicit' };
    }
    
    // Try metadata fields
    if ((order as any)?.metadata?.destinationCountryCode) {
      return { countryCode: (order as any).metadata.destinationCountryCode, source: 'metadata' };
    }
    if ((order as any)?.metadata?.receiverCountryCode) {
      return { countryCode: (order as any).metadata.receiverCountryCode, source: 'metadata' };
    }
    
    // If we have a postal code, try to fetch from geo-location API
    if (delivery?.zip) {
      try {
        const countryCode = await this.fetchAndValidateCountryCode(delivery.zip);
        if (countryCode) {
          return { countryCode, source: 'geoLocation' };
        }
      } catch (error) {
        // Silently fall back to other methods
      }
    }
    
    // Default fallback
    return { countryCode: 'CA', source: 'default' };
  }
  
  /**
   * Maps country name to country code (basic mapping)
   */
  private getCountryCodeFromName(countryName: string): string | null {
    if (!countryName) return null;
    
    const nameToCode: { [key: string]: string } = {
      'india': 'IN',
      'united states': 'US',
      'usa': 'US',
      'united kingdom': 'GB',
      'uk': 'GB',
      'canada': 'CA',
      'australia': 'AU',
      'germany': 'DE',
      'france': 'FR',
      'italy': 'IT',
      'spain': 'ES',
      'japan': 'JP',
      'china': 'CN',
      'south korea': 'KR',
      'brazil': 'BR',
      'mexico': 'MX',
      'russia': 'RU',
    };
    
    const normalized = countryName.toLowerCase().trim();
    return nameToCode[normalized] || null;
  }

  /**
   * Fetches and validates country code from geo-location API using postal code
   * Similar to ARAMEX service implementation
   */
  private async fetchAndValidateCountryCode(
    postalCode: string
  ): Promise<string> {
    const geo_url = this.configService.get<string>("GEO_LOCATION_URL");
    if (!geo_url) {
      return null;
    }
    
    const url = `${geo_url}?&postal_codes=${postalCode}&offset=0&limit=1`;
    try {
      const resp = await firstValueFrom(this.httpService.get(url));
      const data = resp?.data?.data?.[0];
      const countryCode = data?.country_code?.trim();
      
      if (countryCode) {
        return countryCode;
      }
      
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Failed to fetch geo-location for postal code ${postalCode}: No country code in response`
      );
    } catch (err) {
      if (err instanceof CustomHttpException) {
        throw err;
      }
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Failed to fetch geo-location for postal code ${postalCode}: ${err.message}`
      );
    }
  }

  /**
   * Gets country name from country code
   */
  private getCountryName(countryCode: string): string {
    const countryNameMap: Record<string, string> = {
      'CA': 'CANADA',
      'US': 'United States',
      'GB': 'United Kingdom',
      'AU': 'Australia',
      'DE': 'Germany',
      'FR': 'France',
      'IT': 'Italy',
      'ES': 'Spain',
      'JP': 'Japan',
      'CN': 'China',
      'KR': 'South Korea',
      'BR': 'Brazil',
      'MX': 'Mexico',
      'RU': 'Russia',
      'IN': 'India',
    };
    return countryNameMap[countryCode?.toUpperCase()] || countryCode || 'CANADA';
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
   * Gets booking reference ID from IndiaPost API
   * This is required before creating a booking
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
      const productCode = this.getProductCode(mailTypeCd);
      const bookingReferencePath = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BOOKING_REFERENCE_PATH,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BOOKING_REFERENCE_PATH
      );
      const url = `${baseUrl}${bookingReferencePath}?office-id=${officeId}&product-code=${productCode}`;

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
        return { bookingRefId, productCode };
      }

      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `IndiaPost International: Failed to get booking reference. Response: ${JSON.stringify(response.data)}`
      );
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error;
      }
      this.logger.error(`[IndiaPost International] Failed to get booking reference: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `IndiaPost International: Failed to get booking reference: ${error.message}`
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
    mailTypeCd?: string,
    destinationCountryCode?: string
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
    const bookingTypeCd = "RCB"//this.getBookingTypeCd(order);
    
    // Get office ID from config (should match the one used for booking reference)
    const officeIdBkg = parseInt(this.configService.get<string>(
      INDIAPOST_INTERNATIONAL_ENV_KEYS.OFFICE_ID,
      INDIAPOST_INTERNATIONAL_DEFAULTS.OFFICE_ID
    ));

    // Transform sub_pieces from items
      const now = new Date();
    const invoiceDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    
    // Use provided destination country code or fallback to synchronous lookup
    const finalDestinationCountryCode = destinationCountryCode 
      || delivery?.countryCode 
      || delivery?.country 
      || (order as any)?.metadata?.destinationCountryCode 
      || (order as any)?.metadata?.receiverCountryCode
      || 'CA';
    const destinationCountryName = this.getCountryName(finalDestinationCountryCode);
    
    const subPieces: IndiaPostInternationalSubPieceDto[] = items.map((item, index) => {
      const itemWeight = Math.round(parseFloat(String(item.weight || 0)) || physicalWeight);
      const invoiceValue = parseFloat(String(item.unitPrice || 0));
      const destinationCurrency = finalDestinationCountryCode === 'CA' ? 'CAD' : finalDestinationCountryCode === 'US' ? 'USD' : 'USD';
      const exchangeRate = finalDestinationCountryCode === 'CA' ? 62.25 : 75; // CAD->INR or USD->INR
      const fobValue = Math.round((invoiceValue / exchangeRate) * 100) / 100;
      const hsnCode = String(item.hsnCode || '34011190').replace(/\D/g, '');
      
      return {
        hs_cd: hsnCode,
        cth_cd: hsnCode,
        hs_description: this.sanitizeAddressField(String(item.description || item.name || 'Goods')),
        sp_unit_cd: 'PIECES',
        // article_number: articleNumber,
        sp_origin_country_cd: 'IN',
        sp_weight_total: itemWeight,
        sp_weight_nett: itemWeight > 50 ? itemWeight - 50 : itemWeight,
        sp_invoice_lsn: index + 1,
        sp_invoice_value: invoiceValue,
        sp_asbl_fob_value: fobValue,
        sp_asbl_currency_cd: destinationCurrency,
        sp_asbl_currency_exchrate: exchangeRate,
        sp_asbl_value_inr: invoiceValue,
        sp_origin_currency_cd: 'INR',
        sp_comm_invoice_no: order.referenceId || String(index + 1),
        sp_inv_currency_exchrate: 1,
        sp_count: parseInt(String(item.quantity || 1)),
        sp_comm_invoice_date: invoiceDate,
        sp_tax_invoice_no: order.referenceId || `INV-${index + 1}`,
        sp_tax_invoice_date: invoiceDate,
        sp_inv_currency_cd: destinationCurrency,
        sp_invoice_value_total: invoiceValue,
        channel_type_cd: 'K',
        tax_payment_channel_source: 'other',
        tax_payment_mode_cd: 'oth-c',
        compensation_cess_rate: 0,
        compensation_cess_amount: 0,
        ecommerce_url: (order as any).metadata?.ecommerceUrl || 'AMAZON.CA',
        ecommerce_paytranid: order.orderId || '',
        ecommerce_sku: String(item.sku || ''),
        export_duty_rate: 0,
        export_duty_amount: 0,
        cess_rate: 0,
        cess_amount: 0,
        igst_rate: 0,
        igst_amount: 0,
        created_by: (order as any).metadata?.createdBy || '1352103376',
        office_id_bkg: officeIdBkg,
        ip_address_bkg: (order as any).metadata?.ipAddress || '157.245.96.66',
        usertype_cd: 'R',
      };
    });


    // Format phone numbers - alt_contact_no should be 10 digits string, mobile_no should be 10-digit integer
    const senderAltContactNo = this.formatPhoneTo10Digits(pickup.phone, pickup.countryCode || 'IN');
    const receiverAltContactNo = this.formatPhoneTo10Digits(delivery.phone, finalDestinationCountryCode);
    const senderMobileNo = this.formatPhoneToInteger(pickup.phone, pickup.countryCode || 'IN');
    const receiverMobileNo = this.formatPhoneToInteger(delivery.phone, finalDestinationCountryCode);

    // Format receiver zipcode
    const receiverZipcode = String(delivery.zip).replace(/\D/g, '');

    return {
      origin: String(pickup.zip),
      iec_code: (order as any).metadata?.iecCode || 'BQHPG9541C',
      sender_pincode: parseInt(pickup.zip),
      destination_ccode: finalDestinationCountryCode,
      destination_cname: destinationCountryName,
      mail_type_cd: mailTypeCd || this.getMailTypeCd(order),
      mail_class_cd: this.getMailClassCd(mailTypeCd || this.getMailTypeCd(order)),
      mail_nature_type_cd: '11',
      booking_type_cd: bookingTypeCd,
      bulk_customer_id: parseInt(this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BULK_CUSTOMER_ID,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BULK_CUSTOMER_ID
      )),
      child_customer_id: parseInt(this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.CHILD_CUSTOMER_ID,
        INDIAPOST_INTERNATIONAL_DEFAULTS.CHILD_CUSTOMER_ID
      )),
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
      receiver_country: destinationCountryName,
      receiver_country_code: finalDestinationCountryCode,
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

  /**
   * Generate label for India Post International order
   * Makes API call to label creation endpoint
   * @param articleNumberOrBookingRef - Article number or booking reference ID
   * @param officeCustomer - Office customer ID (not used, but kept for compatibility)
   * @returns Label data (base64 image and barcode)
   */
  private async generateLabel(
    articleNumberOrBookingRef: string,
    officeCustomer: string
  ): Promise<{ label_url?: string; label_base64?: string; label_barcode?: string } | null> {
    try {
      const baseUrl = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BASE_URL,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BASE_URL
      );
      const createLabelPath = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.CREATE_LABEL_PATH,
        INDIAPOST_INTERNATIONAL_DEFAULTS.CREATE_LABEL_PATH
      );
      const url = `${baseUrl}${createLabelPath}`;

      // Build label request payload
      const labelPayload: IndiaPostInternationalCreateLabelRequestDto = {
        office_customer: "CUSTOMER",
        article_type: "INTL_APP_EPACKET",
      };

      // Get authentication headers
      const authHeaders = await this.indiaPostInternationalAuthService.getAuthHeaders();
      const response = await firstValueFrom(
        this.httpService.post<IndiaPostInternationalCreateLabelResponseDto>(
          url,
          labelPayload,
          {
            headers: authHeaders,
            timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
            validateStatus: () => true,
          }
        )
      );

      if (response.status === 200 || response.status === 201) {
        const responseData = response.data as any;
        const labelData = responseData?.data;
        if (labelData?.base64Image) {
          return {
            label_url: labelData.label_url,
            label_base64: labelData.base64Image,
            label_barcode: labelData.barcode,
          };
        }
      }

      // Log error information for debugging
      const errorData = response.data as any;
      const errorMessage = errorData?.error?.message || errorData?.message || 'Unknown error';
      this.logger.warn(`[IndiaPost International] Label creation failed - Status: ${response.status}, Error: ${errorMessage}`);
      
      return null;
    } catch (error) {
      this.logger.error(`[IndiaPost International] Label generation failed: ${error.message}`);
      if (error.response) {
        this.logger.error(`[IndiaPost International] Label API error response: ${JSON.stringify(error.response.data)}`);
      }
      return null;
    }
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

  async pushOrderToHubOpsV2<T extends StandardRequestDto, R extends BaseResDto>(data: T): Promise<R> { return this.pushOrderToHubOps(data); }

  async updateOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }

  async updatePartnerToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for IndiaPost International');
  }
}

