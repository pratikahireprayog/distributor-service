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
    try {
      this.logger.log(`Creating order with IndiaPost International: ${orderDetails.orderId}`);

      // Validate required fields
      if (!orderDetails || !orderDetails.addresses) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Order details and addresses are required'
        );
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

      // Transform payload
      const payload = this.transformToIndiaPostInternationalPayload(orderDetails);

      // Get authentication headers
      const authHeaders = await this.indiaPostInternationalAuthService.getAuthHeaders();

      this.logger.log(`Calling IndiaPost International API: ${url}`);
      this.logger.debug(`Request payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostInternationalCreateOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`IndiaPost International API returned status ${response.status}`, response.data);
        
        return {
          statusCode: response.status,
          message: `IndiaPost International API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.INDIA_POST_INTERNATIONAL,
          data: {
            originalResponse: response.data,
            requestUrl: url,
            requestBody: payload,
            shipmentDetails: {
              trackingDetails: [],
              documents: [],
            },
            error: true,
          },
        } as unknown as R;
      }

      const responseData = response.data;

      // Extract partner AWB number (pbe_no) from Article object
      const partnerAwbNumber = responseData?.data?.Article?.pbe_no 
        ? String(responseData.data.Article.pbe_no) 
        : '';

      // Extract label URL
      const labelUrl = responseData?.data?.label_url || '';

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
                awbNumber: orderDetails.parentShipment?.awbNumber || orderDetails.awbNumber || orderDetails.orderId,
                partnerAwbNumber: partnerAwbNumber,
                partnerName: PARTNER_CODE_ENUM.INDIA_POST_INTERNATIONAL,
                transporterId: 'INDIA_POST_INTERNATIONAL',
              },
            ],
            documents: [
              {
                content: labelUrl,
                type: 'label',
                format: 'url',
              },
            ],
          },
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`IndiaPost International createOrderV2 failed: ${error.message}`, error.stack);
      
      const baseUrl = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BASE_URL,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.CREATE_ORDER_PATH,
        INDIAPOST_INTERNATIONAL_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;
      
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
   * Formats phone number to ISD format with 00 prefix
   * Max 21 digits (inclusive of ISD Code)
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
   * Converts weight to GRAMS without decimals
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

    // Get weights and convert to grams (no decimals)
    const physicalWeightRaw = getEffectiveWeight(order.parentShipment || order.childShipments?.[0]);
    const volumetricWeightRaw = parseFloat(String(order.parentShipment?.volumetricWeight || order.childShipments?.[0]?.volumetricWeight || 600));
    
    const physicalWeight = this.convertWeightToGrams(physicalWeightRaw, 'kg');
    const volumetricWeight = this.convertWeightToGrams(volumetricWeightRaw, 'kg');
    const chargedWeight = Math.max(physicalWeight, volumetricWeight);

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
      const invoiceDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      
      return {
        hs_cd: String(item.hsnCode || '44219090'),
        cth_cd: String(item.hsnCode || '44219090'),
        hs_description: this.sanitizeAddressField(String(item.description || item.name || 'Product')),
        sp_unit_cd: 'PIECES',
        article_number: articleNumber,
        sp_origin_country_cd: 'IN',
        sp_weight_total: itemWeight,
        sp_weight_nett: itemWeight,
        sp_invoice_lsn: 123,
        sp_invoice_value: parseFloat(String(item.unitPrice || 700)),
        sp_asbl_fob_value: parseFloat(String(item.unitPrice || 700)),
        sp_asbl_currency_cd: 'US',
        sp_asbl_currency_exchrate: 2,
        sp_asbl_value_inr: parseFloat(String(item.unitPrice || 700)) * 75,
        sp_origin_currency_cd: 'INR',
        sp_comm_invoice_no: String(index + 1),
        sp_inv_currency_exchrate: 75,
        sp_count: parseInt(String(item.quantity || 1)),
        sp_comm_invoice_date: invoiceDate,
        sp_tax_invoice_no: `INV-${index + 1}`,
        sp_tax_invoice_date: invoiceDate,
        sp_inv_currency_cd: 'USD',
        sp_invoice_value_total: parseFloat(String(item.unitPrice || 700)),
        channel_type_cd: 'I',
        tax_payment_channel_source: 'other',
        tax_payment_mode_cd: 'TC',
        compensation_cess_rate: 0,
        compensation_cess_amount: 0,
        ecommerce_url: 'https://ecommerce.example.com',
        ecommerce_paytranid: 'PayTrans123',
        ecommerce_sku: String(item.sku || 'SKU123'),
        export_duty_rate: 0,
        export_duty_amount: 0,
        cess_rate: 0,
        cess_amount: 0,
        igst_rate: 0,
        igst_amount: 0,
        created_by: '10256468',
        office_id_bkg: 90001,
        ip_address_bkg: '192.168.1.1',
        usertype_cd: 'I',
      };
    });

    // If no items, create a default sub_piece
    if (subPieces.length === 0) {
      const defaultWeight = this.convertWeightToGrams(500, 'kg');
      const invoiceDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      
      subPieces.push({
        hs_cd: '44219090',
        cth_cd: '44219090',
        hs_description: 'Product',
        sp_unit_cd: 'PIECES',
        article_number: articleNumber,
        sp_origin_country_cd: 'IN',
        sp_weight_total: defaultWeight,
        sp_weight_nett: defaultWeight,
        sp_invoice_lsn: 123,
        sp_invoice_value: 700,
        sp_asbl_fob_value: 700,
        sp_asbl_currency_cd: 'US',
        sp_asbl_currency_exchrate: 2,
        sp_asbl_value_inr: 1800,
        sp_origin_currency_cd: 'INR',
        sp_comm_invoice_no: '23',
        sp_inv_currency_exchrate: 75,
        sp_count: 1,
        sp_comm_invoice_date: invoiceDate,
        sp_tax_invoice_no: '12356',
        sp_tax_invoice_date: invoiceDate,
        sp_inv_currency_cd: 'USD',
        sp_invoice_value_total: 700,
        channel_type_cd: 'I',
        tax_payment_channel_source: 'other',
        tax_payment_mode_cd: 'TC',
        compensation_cess_rate: 3232,
        compensation_cess_amount: 323,
        ecommerce_url: 'https://ecommerce.example.com',
        ecommerce_paytranid: 'PayTrans123',
        ecommerce_sku: 'SKU123',
        export_duty_rate: 10,
        export_duty_amount: 50,
        cess_rate: 5,
        cess_amount: 25,
        igst_rate: 15,
        igst_amount: 75,
        created_by: '10256468',
        office_id_bkg: 90001,
        ip_address_bkg: '192.168.1.1',
        usertype_cd: 'I',
      });
    }

    // Format phone numbers
    const senderPhone = this.formatPhoneToISD(pickup.phone || '7607858569', pickup.countryCode || 'IN');
    const receiverPhone = this.formatPhoneToISD(delivery.phone || '9876543210', delivery.countryCode || 'US');

    return {
      iec_code: '23232',
      sender_pincode: parseInt(String(pickup.zip || '226010')),
      destination_ccode: String(delivery.countryCode || 'US'),
      destination_cname: String(delivery.country || 'United States'),
      mail_type_cd: 'FGN_SP_MERCHANDISE',
      mail_class_cd: 'C',
      mail_nature_type_cd: '11',
      booking_type_cd: bookingTypeCd,
      bulk_customer_id: 1000000001,
      child_customer_id: 1000000002,
      physical_weight: physicalWeight,
      mail_shape_cd: 'NROL',
      dimension_length: length,
      dimension_breadth: width,
      dimension_height: height,
      volumetric_weight: volumetricWeight,
      charged_weight: chargedWeight,
      declared_value: parseFloat(String(order.payment?.finalAmount || 400)),
      priority_flag: true,
      non_dely_instns_cd: 'A',
      upload_doc_inv_count: 0,
      upload_doc_cert_count: 0,
      upload_doc_lic_count: 0,
      sender_name: this.sanitizeAddressField(String(pickup.name || 'Sender Name')),
      sender_company_name: this.sanitizeAddressField(String(pickup.name || 'My Company')),
      sender_addrline1: this.sanitizeAddressField(String(pickup.street || 'Sender Addr 01')),
      sender_addrline2: this.sanitizeAddressField(String(pickup.landmark || 'Sender Addr 02')),
      sender_addrline3: this.sanitizeAddressField(String(pickup.state || 'Sender Addr 03')),
      sender_city: this.sanitizeAddressField(String(pickup.city || 'Lucknow')),
      sender_state: this.sanitizeAddressField(String(pickup.state || 'UP')),
      sender_country_name: 'India',
      sender_country_code: 'IN',
      sender_email_id: String(pickup.email || 'sender@example.com'),
      sender_alt_contact_no: senderPhone,
      sender_kyc_reference: 'CFUPR34343E',
      sender_tax_reference: '034349347343242',
      receiver_name: this.sanitizeAddressField(String(delivery.name || 'Receiver Name')),
      receiver_company_name: this.sanitizeAddressField(String(delivery.name || 'company')),
      receiver_addrline1: this.sanitizeAddressField(String(delivery.street || 'Receiver Line 1')),
      receiver_addrline2: this.sanitizeAddressField(String(delivery.landmark || 'Receiver Line 2')),
      receiver_addrline3: this.sanitizeAddressField(String(delivery.state || 'Receiver Line 3')),
      receiver_city: this.sanitizeAddressField(String(delivery.city || 'Ohio')),
      receiver_state: this.sanitizeAddressField(String(delivery.state || 'Oregon')),
      receiver_country: String(delivery.country || 'United States'),
      receiver_country_code: String(delivery.countryCode || 'US'),
      receiver_zipcode: String(delivery.zip || '54321'),
      receiver_email_id: String(delivery.email || 'receiver@example.com'),
      receiver_alt_contact_no: receiverPhone,
      receiver_kyc_reference: 'KYC321',
      receiver_tax_reference: 'TaxRef321',
      pbe_type_cd: 'PBE-III',
      pbe_bank_ref: 'Ref34343',
      declaration1: true,
      declaration2: true,
      declaration3: true,
      declaration4: true,
      selffiling_cusbroker: false,
      cus_broker_lic_no: 'Lic123',
      cus_broker_name: 'Customs Broker Name',
      cus_broker_address: 'Customs Address',
      article_number: articleNumber,
      bkg_ref_id: String(order.orderId),
      created_by: '10256468',
      office_id_bkg: 21260721,
      origin_office_name: 'Vrindavan SO',
      ip_address_bkg: '192.168.0.1',
      subpiece_count: subPieces.length,
      status_cd: 'IC',
      user_type_cd: 'R',
      channel_type_cd: 'K',
      contract_id: 10000001,
      sender_mobile_no: parseInt(senderPhone.replace(/^00/, '')) || 917607858569,
      receiver_mobile_no: parseInt(receiverPhone.replace(/^00/, '')) || 19876543210,
      bkg_office_gst_no: 'feafea',
      sender_gst_no: 'fefe',
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

