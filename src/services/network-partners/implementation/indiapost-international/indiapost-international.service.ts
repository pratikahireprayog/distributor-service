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

    const physicalWeight = getEffectiveWeight(order.parentShipment || order.childShipments?.[0]);
    const volumetricWeight = parseFloat(String(order.parentShipment?.volumetricWeight || order.childShipments?.[0]?.volumetricWeight || 600));
    const chargedWeight = Math.max(physicalWeight, volumetricWeight);

    const dimensions = order.parentShipment?.dimensions || order.childShipments?.[0]?.dimensions || { length: 20, width: 30, height: 10 };
    const length = parseFloat(String((dimensions as any).length || 20));
    const width = parseFloat(String((dimensions as any).width || 30));
    const height = parseFloat(String((dimensions as any).height || 10));

    const items = order.parentShipment?.items || order.childShipments?.[0]?.items || [];
    const firstItem = items[0] || {};

    // Transform sub_pieces from items
    const subPieces: IndiaPostInternationalSubPieceDto[] = items.map((item, index) => ({
      hs_cd: String(item.hsnCode || '44219090'),
      cth_cd: String(item.hsnCode || '44219090'),
      hs_description: String(item.description || item.name || 'Product'),
      sp_unit_cd: 'PIECES',
      created_by: '10256468',
      office_id_bkg: 90001,
      ip_address_bkg: '192.168.1.1',
      article_number: String(order.parentShipment?.awbNumber || order.awbNumber || order.orderId),
      igst_rate: 15,
      igst_amount: 75,
      export_duty_rate: 10,
      export_duty_amount: 50,
      cess_rate: 5,
      cess_amount: 25,
      compensation_cess_rate: 3232,
      compensation_cess_amount: 323,
      tax_payment_channel_source: 'aggregator',
      tax_payment_mode_cd: 'oth-c',
      ecommerce_url: 'amazon.com.au',
      sp_count: parseFloat(String(item.quantity || 1)),
      sp_weight_total: parseFloat(String(item.weight || 1000)),
      sp_weight_nett: parseFloat(String(item.weight || 800)),
      sp_inv_currency_cd: 'AUD',
      sp_origin_country_cd: 'IN',
      sp_comm_invoice_no: String(index + 1),
      ecommerce_paytranid: 'PayTrans123',
      sp_tax_invoice_no: `INV-${index + 1}`,
      sp_tax_invoice_date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      sp_invoice_value_total: parseFloat(String(item.unitPrice || 5343)),
      sp_inv_currency_exchrate: 87.01,
      sp_asbl_fob_value: 900.12,
      sp_asbl_value_inr: 1800.45,
      channel_type_cd: 'I',
      sp_comm_invoice_date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      ecommerce_sku: String(item.sku || 'SKU001'),
      sp_invoice_lsn: 123,
      sp_origin_currency_cd: 'USD',
      sp_invoice_value: parseFloat(String(item.unitPrice || 700)),
      sp_asbl_currency_cd: 'US',
      sp_asbl_currency_exchrate: 2,
      user_type_cd: 'DR',
    }));

    // If no items, create a default sub_piece
    if (subPieces.length === 0) {
      subPieces.push({
        hs_cd: '44219090',
        cth_cd: '44219090',
        hs_description: 'Product',
        sp_unit_cd: 'PIECES',
        created_by: '10256468',
        office_id_bkg: 90001,
        ip_address_bkg: '192.168.1.1',
        article_number: String(order.parentShipment?.awbNumber || order.awbNumber || order.orderId),
        igst_rate: 15,
        igst_amount: 75,
        export_duty_rate: 10,
        export_duty_amount: 50,
        cess_rate: 5,
        cess_amount: 25,
        compensation_cess_rate: 3232,
        compensation_cess_amount: 323,
        tax_payment_channel_source: 'aggregator',
        tax_payment_mode_cd: 'oth-c',
        ecommerce_url: 'amazon.com.au',
        sp_count: 1,
        sp_weight_total: 1000,
        sp_weight_nett: 800,
        sp_inv_currency_cd: 'AUD',
        sp_origin_country_cd: 'IN',
        sp_comm_invoice_no: '23',
        ecommerce_paytranid: 'PayTrans123',
        sp_tax_invoice_no: 'INV-1',
        sp_tax_invoice_date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        sp_invoice_value_total: 5343,
        sp_inv_currency_exchrate: 87.01,
        sp_asbl_fob_value: 900.12,
        sp_asbl_value_inr: 1800.45,
        channel_type_cd: 'I',
        sp_comm_invoice_date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        ecommerce_sku: 'WB1ACL0101000',
        sp_invoice_lsn: 123,
        sp_origin_currency_cd: 'USD',
        sp_invoice_value: 700,
        sp_asbl_currency_cd: 'US',
        sp_asbl_currency_exchrate: 2,
        user_type_cd: 'DR',
      });
    }

    return {
      destination_ccode: String(delivery.countryCode || 'US'),
      destination_cname: String(delivery.country || 'United States'),
      mail_type_cd: 'FGN_SP_MERCHANDISE',
      mail_class_cd: 'C',
      mail_nature_type_cd: '11',
      booking_type_cd: 'COM',
      bulk_customer_id: 1000000001,
      physical_weight: physicalWeight,
      child_customer_id: 1000000002,
      mail_shape_cd: 'NROL',
      dimension_length: length,
      dimension_breadth: width,
      dimension_height: height,
      volumetric_weight: volumetricWeight,
      charged_weight: chargedWeight,
      declared_value: parseFloat(String(order.payment?.finalAmount || 4005)),
      priority_flag: true,
      non_dely_instns_cd: 'D',
      sender_name: String(pickup.name || 'Sender Name'),
      sender_company_name: String(pickup.name || 'Company'),
      sender_addrline1: String(pickup.street || 'Address Line 1'),
      sender_addrline2: String(pickup.landmark || ''),
      sender_addrline3: String(pickup.state || ''),
      sender_city: String(pickup.city || 'City'),
      sender_state: String(pickup.state || 'HR'),
      sender_country_name: 'India',
      sender_country_code: 'IN',
      sender_email_id: String(pickup.email || 'sender@example.com'),
      sender_alt_contact_no: String(pickup.phone || '7607858569'),
      sender_kyc_reference: 'CFUPR34343E',
      sender_tax_reference: '034349347343242',
      sender_pincode: parseInt(String(pickup.zip || '226011')),
      receiver_name: String(delivery.name || 'Receiver Name'),
      receiver_company_name: String(delivery.name || ''),
      receiver_addrline1: String(delivery.street || 'Address Line 1'),
      receiver_addrline2: String(delivery.landmark || ''),
      receiver_addrline3: String(delivery.state || ''),
      receiver_city: String(delivery.city || 'City'),
      receiver_state: String(delivery.state || 'State'),
      receiver_country: String(delivery.country || 'United States'),
      receiver_country_code: String(delivery.countryCode || 'US'),
      receiver_zipcode: String(delivery.zip || '54321'),
      receiver_email_id: String(delivery.email || 'receiver@example.com'),
      receiver_alt_contact_no: String(delivery.phone || '+987654321123'),
      receiver_kyc_reference: 'KYC321',
      receiver_tax_reference: 'TaxRef321',
      pbe_type_cd: 'PBE-I',
      pbe_bank_ref: 'Ref34343',
      upload_doc_inv_count: 0,
      upload_doc_cert_count: 0,
      upload_doc_lic_count: 0,
      declaration1: false,
      declaration2: true,
      declaration3: false,
      declaration4: true,
      selffiling_cusbroker: false,
      cus_broker_lic_no: 'Lic123',
      cus_broker_name: 'Customs Broker Name',
      cus_broker_address: 'Customs Address',
      article_number: String(order.parentShipment?.awbNumber || order.awbNumber || order.orderId),
      bkg_ref_id: String(order.orderId),
      ip_address_bkg: '192.168.0.1',
      user_type_cd: 'D',
      channel_type_cd: 'I',
      office_id_bkg: 21260721,
      origin_office_name: 'Vrindavan SO',
      sender_mobile_no: parseInt(String(pickup.phone || '9876543210').replace(/\D/g, '')) || 9876543210,
      receiver_mobile_no: parseInt(String(delivery.phone || '9876543210').replace(/\D/g, '')) || 9876543210,
      contract_id: 10000001,
      status_cd: 'BK',
      created_by: '10256468',
      sender_gst_no: 'fefe',
      subpiece_count: subPieces.length,
      iec_code: '23232',
      bkg_office_gst_no: 'feafea',
      pod_ack_charge: 3,
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

