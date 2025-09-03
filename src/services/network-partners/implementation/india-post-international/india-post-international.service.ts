import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";
import { v4 as uuidv4 } from "uuid";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { IndiaPostInternationalAuthService } from "./india-post-international.auth-service";

import {
  BaseOrderResDto,
  BaseCancelOrderDto,
  BaseResDto,
} from "src/common/dtos/base.dto";
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2, BaseUpdateOrderDtoV2 } from "src/common/dtos/base2.dto";

import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { AxiosResponse } from "axios";

@Injectable()
export class IndiaPostInternationalService extends BaseNetworkPartner {
  protected readonly logger = new Logger(IndiaPostInternationalService.name);
  private readonly httpsAgent: https.Agent;

  constructor(
    protected readonly authProvider: IndiaPostInternationalAuthService,
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.INDIA_POST_INTERNATIONAL,
      authProvider,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      timeout: 60000,
    });
  }

  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      const transformedData = this.transformIndiaPostPayload(orderDetails);

      const endpoint = {
          url: this.configService.get<string>('INDIA_POST_CREATE_ORDER_URL')
      }

      if (!endpoint.url) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'INDIA_POST_CREATE_ORDER_URL environment variable is not configured'
        );
      }

      const response = await this.callIndiaPostCreateOrderAPI(
        endpoint,
        transformedData,
      );

      return this.formatCreateOrderResponse<R>(response);
    } catch (error) {
      this.logger.error(`India Post International createOrder error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  private transformIndiaPostPayload<T extends BaseOrderReqDtoV2>(orderDetails: T): any {
    this.logger.debug("India Post International payload transformation", orderDetails);
    const pickupAddress: any = orderDetails.addresses?.find((a: any) => a.type === 'PICKUP') || {};
    const deliveryAddress: any = orderDetails.addresses?.find((a: any) => a.type === 'DELIVERY') || {};
    const referenceNumber = `IP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Static code tables and seller defaults (dev-only; replace via config later)
    const STATIC_CODES = {
      mail_type_cd: 'FGN_SP_MERCHANDISE',
      mail_class_cd: 'C',
      mail_nature_type_cd: '11',
      mail_transport_type_cd: 'SAL',
      booking_type_cd: 'WIC',
      mail_form_cd: 'LB',
      mail_shape_cd: 'NROL',
      prepayment_type_cd: 'PS',
      status_cd: 'BK',
    } as const;

    const STATIC_SELLER = {
      iec_code: '23232',
      bulk_customer_id: 1000000001,
      sender_kyc_reference: 'CFUPR34343E',
      sender_tax_reference: '034349347343242',
      bkg_office_gst_no: 'feafea',
      sender_gst_no: 'fefe',
      contract_id: 10000001,
      origin_office_name: 'Vrindavan SO',
    } as const;

    const STATIC_BROKER = {
      cus_broker_lic_no: 'Lic123',
      cus_broker_name: 'Customs Broker Name',
      cus_broker_address: 'Customs Address',
      pbe_type_cd: 'PBE-I',
      pbe_bank_ref: 'Ref34343',
    } as const;

    const STATIC_ALT = {
      alt_addressee_name: 'alt afeaf',
      alt_address_line1: 'altafeaf',
      alt_address_line2: 'altafeaf',
      alt_address_line3: 'altafeaf',
      alt_city: 'lko',
      alt_state: 'IPd',
      alt_pincode: 249341,
      alt_email_id: 'aabhsih@gmail.com',
      alt_alt_contact_no: '34343',
      alt_kyc_reference: '32',
      alt_tax_reference: '3343',
      alt_mobile_no: 6304934032,
      alt_company_name: 'feafea',
      alt_office_pincode: 226010,
      alt_office_id: 21260721,
      alt_office_name: 'abhishek',
    } as const;

    const STATIC_CHARGES = {
      value_of_prepayment: 34,
      vp_cod_type_cd: 'vp',
      value_for_vp_cod: 10,
      vp_cod_charge: 2,
      insurance_type: 'DOP',
      value_insurance: 2,
      insurance_charge: 34,
      pod_ack_charge: 3,
      door_delivery_charge: 10,
      premailing_charge: 2,
      parcel_packing_charge_with_box: 2,
      parcel_packing_charge_without_box: 2,
      parcel_packing_bubble_wrap_charge: 2,
      parcel_packing_service_charge: 2,
    } as const;

    const STATIC_PICKUP = {
      pickup_charge: 30,
      pickup_schedule_slot: '08:00-09:00',
    } as const;

    // Helpers
    const toNumberOrEmpty = (v: any): number | string =>
      v === undefined || v === null || v === '' ? '' : Number(v);

    const formatDate = (iso?: string): string => {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    const allItems = [
      ...(orderDetails.parentShipment?.items || []),
      ...((orderDetails.childShipments || []).flatMap((s: any) => s.items || [])),
    ];

    // Deduplicate items based on AWB number and SKU to avoid duplicate barcode errors
    const uniqueItems = new Map();
    allItems.forEach((it: any) => {
      const key = `${it.sku || it.name}-${orderDetails.parentShipment?.awbNumber || ''}`;
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, it);
      } else {
        // If duplicate found, merge quantities
        const existing = uniqueItems.get(key);
        existing.quantity = (existing.quantity || 0) + (it.quantity || 0);
        existing.weight = (existing.weight || 0) + (it.weight || 0);
      }
    });

    const sub_pieces = Array.from(uniqueItems.values()).map((it: any) => ({
      hs_cd: it.hsnCode || '',
      cth_cd: 'CTHCode1',
      hs_description: 'HS Description',
      sp_unit_cd: 'Unit123',
      sp_origin_country_cd: 'CHN',
      sp_weight_total: toNumberOrEmpty((it.weight || 0) + 200), // Add packaging weight
      sp_weight_nett: toNumberOrEmpty(it.weight),
      sp_invoice_lsn: 123,
      sp_invoice_value: toNumberOrEmpty((it.unitPrice || 0) - 500), // Subtract tax
      sp_asbl_fob_value: toNumberOrEmpty((it.unitPrice || 0) - 1000), // Subtract shipping
      sp_asbl_currency_cd: 'US',
      sp_asbl_currency_exchrate: 2,
      sp_asbl_value_inr: toNumberOrEmpty((it.unitPrice || 0) * 2), // Convert USD to INR using exchange rate
      sp_origin_currency_cd: 'CFG',
      sp_comm_invoice_no: '23',
      sp_inv_currency_exchrate: 75,
      sp_count: 1,
      sp_comm_invoice_date: '22-01-2024',
      sp_tax_invoice_no: '12356',
      sp_tax_invoice_date: '22-01-2024',
      sp_invoice_value_pu: toNumberOrEmpty((it.unitPrice || 0) - 1000), // Subtract discount
      sp_inv_currency_cd: 'CFG',
      sp_invoice_value_total: toNumberOrEmpty((it.unitPrice || 0) * (it.quantity || 0) + 5000), // Add additional charges
      user_type_cd: 'DR',
      channel_type_cd: 'I',
      tax_payment_channel_source: 'other',
      tax_payment_mode_cd: 'TC',
      tax_payment_channel_ref_no: 223,
      tax_payment_channel_date: '22-01-2024',
      compensation_cess_rate: 3232,
      compensation_cess_amount: 323,
      ecommerce_status: 'EcommStatus1',
      ecommerce_url: 'https://ecommerce.example.com',
      ecommerce_paytranid: 'PayTrans123',
      ecommerce_sku: it.sku || '',
      export_duty_rate: 10,
      export_duty_amount: 50,
      cess_rate: 5,
      cess_amount: 25,
      igst_rate: 15,
      igst_amount: 75,
      compensation_rate: 20,
      compensation_amount: 100,
      lut_details: true,
      created_by: orderDetails.metadata?.createdBy || 'system',
      counter_no: 1,
      shift_no: 2,
      office_id_bkg: 21260721,
      ip_address_bkg: '192.168.1.1',
      usertype_cd: 'I',
      channeltype_cd: 'D',
    }));

    const volumetrics: number[] = [];
    const pushNum = (n: any) => {
      if (n !== undefined && n !== null && n !== '' && !isNaN(Number(n))) volumetrics.push(Number(n));
    };
    pushNum(orderDetails.parentShipment?.volumetricWeight);
    (orderDetails.childShipments || []).forEach((s: any) => pushNum(s.volumetricWeight));
    const charged_weight = volumetrics.length
      ? Math.max(...volumetrics)
      : (orderDetails.parentShipment?.physicalWeight ?? '');

    const taxBreakdown = orderDetails.payment?.breakdown?.taxes || [];
    const tax_amount = taxBreakdown.reduce((sum: number, t: any) => sum + (Number(t.chargedAmount) || 0), 0);
    const shippingCharge = (orderDetails.payment?.breakdown?.otherCharges || []).find((c: any) => (c.name || '').toLowerCase().includes('shipping'));

    const parentShipmentAny: any = (orderDetails as any).parentShipment || {};

    // Build a unique 13-digit numeric article number from numeric IDs + timestamp
    const numericSeed = [
      parentShipmentAny.cAwbNumber,
      parentShipmentAny.awbNumber,
      parentShipmentAny.smileAwbNumber,
      (orderDetails as any).referenceId,
      (orderDetails as any).orderId,
    ]
      .filter(Boolean)
      .join('');
    const numericBase = (numericSeed + Date.now().toString()).replace(/\D/g, '');
    const finalArticleNumber = (numericBase.length >= 13)
      ? numericBase.slice(-13)
      : (('0000000000000' + numericBase).slice(-13));

    const hasPickup = Array.isArray((orderDetails as any).addresses) && (orderDetails as any).addresses.some((a: any) => a?.type === 'PICKUP');
    const pickupSlot = (orderDetails as any).slots?.find((s: any) => s?.slotType === 'PICKUP');

    const transformedData = {
      iec_code: STATIC_SELLER.iec_code,
      sender_contact_no: pickupAddress.phone || '',
      receiver_contact_no: deliveryAddress.phone || '',
      origin: toNumberOrEmpty(pickupAddress.zip),
      origin_ccode: 'IN',
      destination_ccode: deliveryAddress.countryCode || '',
      destination_cname: deliveryAddress.country || '',
      mail_type_cd: STATIC_CODES.mail_type_cd,
      mail_class_cd: STATIC_CODES.mail_class_cd,
      mail_nature_type_cd: STATIC_CODES.mail_nature_type_cd,
      mail_transport_type_cd: STATIC_CODES.mail_transport_type_cd,
      booking_type_cd: STATIC_CODES.booking_type_cd,
      bulk_customer_id: STATIC_SELLER.bulk_customer_id,
      mail_form_cd: STATIC_CODES.mail_form_cd,
      physical_weight: toNumberOrEmpty(orderDetails.parentShipment?.physicalWeight),
      mail_shape_cd: STATIC_CODES.mail_shape_cd,
      dimension_length: toNumberOrEmpty(orderDetails.parentShipment?.dimensions?.length),
      dimension_breadth: toNumberOrEmpty(orderDetails.parentShipment?.dimensions?.width),
      dimension_height: toNumberOrEmpty(orderDetails.parentShipment?.dimensions?.height),
      volumetric_weight: toNumberOrEmpty(orderDetails.parentShipment?.volumetricWeight),
      charged_weight: toNumberOrEmpty(charged_weight),
      prepayment_type_cd: STATIC_CODES.prepayment_type_cd,
      upload_doc_inv_count: (orderDetails.documents || []).filter((d: any) => (d.type || '').toLowerCase().includes('invoice')).length || 0,
      upload_doc_cert_count: (orderDetails.documents || []).filter((d: any) => (d.type || '').toLowerCase().includes('cert')).length || 0,
      upload_doc_lic_count: (orderDetails.documents || []).filter((d: any) => (d.type || '').toLowerCase().includes('lic')).length || 0,
      declared_value: toNumberOrEmpty(orderDetails.payment?.finalAmount),
      priority_flag: orderDetails.serviceType ? true : false,
      instructions_delivery: orderDetails.parentShipment?.note || '',
      non_dely_instns_cd: 'D',

      sender_name: pickupAddress.name || '',
      sender_company_name: pickupAddress.addressName || '',
      sender_addrline1: pickupAddress.street || '',
      sender_addrline2: pickupAddress.landmark || '',
      sender_addrline3: '',
      sender_city: pickupAddress.city || '',
      sender_state: pickupAddress.state || '',
      sender_country_name: pickupAddress.country || 'India',
      sender_country_code: 'IN',
      sender_pincode: toNumberOrEmpty(pickupAddress.zip),
      sender_email_id: pickupAddress.email || '',
      sender_alt_contact_no: pickupAddress.phone || '',
      sender_kyc_reference: STATIC_SELLER.sender_kyc_reference,
      sender_tax_reference: STATIC_SELLER.sender_tax_reference,

      receiver_name: deliveryAddress.name || '',
      receiver_company_name: deliveryAddress.addressName || '',
      receiver_addrline1: deliveryAddress.street || '',
      receiver_addrline2: deliveryAddress.landmark || '',
      receiver_addrline3: '',
      receiver_city: deliveryAddress.city || '',
      receiver_state: deliveryAddress.state || '',
      receiver_country: deliveryAddress.country || '',
      receiver_country_code: deliveryAddress.countryCode || '',
      receiver_zipcode: deliveryAddress.zip || '',
      receiver_email_id: deliveryAddress.email || '',
      receiver_alt_contact_no: deliveryAddress.phone || '',
      receiver_kyc_reference: '',
      receiver_tax_reference: '',

      alt_addr_flag: true,
      pbe_type_cd: STATIC_BROKER.pbe_type_cd,
      pbe_bank_ref: STATIC_BROKER.pbe_bank_ref,
      declaration1: true,
      declaration2: true,
      declaration3: true,
      declaration4: true,
      selffiling_cusbroker: false,
      cus_broker_lic_no: STATIC_BROKER.cus_broker_lic_no,
      cus_broker_name: STATIC_BROKER.cus_broker_name,
      cus_broker_address: STATIC_BROKER.cus_broker_address,
      address_ref_sender: '',
      address_ref_receiver: '',
      address_ref_sender_alt: '',
      address_ref_receiver_akt_addr: '',

      article_number: finalArticleNumber,
      subpiece_count: sub_pieces.length,
      base_tariff: toNumberOrEmpty(shippingCharge?.chargedAmount || 0),
      tax_amount: toNumberOrEmpty(tax_amount),
      total_tariff: toNumberOrEmpty(orderDetails.payment?.finalAmount),
      bkg_ref_id: orderDetails.referenceId || '',
      status_cd: STATIC_CODES.status_cd,
      created_by: orderDetails.metadata?.createdBy || 'system',
      counter_no: 1,
      shift_no: 2,
      office_id_bkg: 21260721,
      ip_address_bkg: '192.168.0.1',
      user_type_cd: 'D',
      channel_type_cd: 'I',
      date_of_delivery: formatDate(orderDetails.expectedDeliveryDate),
      contract_id: STATIC_SELLER.contract_id,
      origin_office_name: STATIC_SELLER.origin_office_name,
      sender_mobile_no: toNumberOrEmpty(pickupAddress.phone),
      receiver_mobile_no: toNumberOrEmpty(deliveryAddress.phone),
      sgst: 3,
      cgst: 3,
      igst: 2,
      utgst: 3,
      bkg_office_gst_no: STATIC_SELLER.bkg_office_gst_no,
      sender_gst_no: STATIC_SELLER.sender_gst_no,

      // Alt address and pickup details left empty/derived later; normalizer will set ""
      alt_addressee_name: STATIC_ALT.alt_addressee_name,
      alt_address_line1: STATIC_ALT.alt_address_line1,
      alt_address_line2: STATIC_ALT.alt_address_line2,
      alt_address_line3: STATIC_ALT.alt_address_line3,
      alt_city: STATIC_ALT.alt_city,
      alt_state: STATIC_ALT.alt_state,
      alt_pincode: STATIC_ALT.alt_pincode,
      alt_email_id: STATIC_ALT.alt_email_id,
      alt_alt_contact_no: STATIC_ALT.alt_alt_contact_no,
      alt_kyc_reference: STATIC_ALT.alt_kyc_reference,
      alt_tax_reference: STATIC_ALT.alt_tax_reference,
      alt_mobile_no: STATIC_ALT.alt_mobile_no,
      alt_company_name: STATIC_ALT.alt_company_name,
      alt_office_pincode: STATIC_ALT.alt_office_pincode,
      alt_office_id: STATIC_ALT.alt_office_id,
      alt_office_name: STATIC_ALT.alt_office_name,

      value_of_prepayment: STATIC_CHARGES.value_of_prepayment,
      vp_cod_type_cd: STATIC_CHARGES.vp_cod_type_cd,
      value_for_vp_cod: STATIC_CHARGES.value_for_vp_cod,
      vp_cod_charge: STATIC_CHARGES.vp_cod_charge,
      insurance_type: STATIC_CHARGES.insurance_type,
      value_insurance: STATIC_CHARGES.value_insurance,
      insurance_charge: STATIC_CHARGES.insurance_charge,
      pod_ack_charge: STATIC_CHARGES.pod_ack_charge,
      door_delivery_charge: STATIC_CHARGES.door_delivery_charge,
      premailing_charge: STATIC_CHARGES.premailing_charge,
      parcel_packing_charge_with_box: STATIC_CHARGES.parcel_packing_charge_with_box,
      parcel_packing_charge_without_box: STATIC_CHARGES.parcel_packing_charge_without_box,
      parcel_packing_bubble_wrap_charge: STATIC_CHARGES.parcel_packing_bubble_wrap_charge,
      parcel_packing_service_charge: STATIC_CHARGES.parcel_packing_service_charge,

      sub_pieces,
      pickup_flag: hasPickup,
      pickup_addressee_name: pickupAddress.name || '',
      pickup_charge: STATIC_PICKUP.pickup_charge,
      pickup_schedule_slot: pickupSlot ? `${pickupSlot.startTime || ''}-${pickupSlot.endTime || ''}` : STATIC_PICKUP.pickup_schedule_slot,
      pickup_office_pincode: toNumberOrEmpty(pickupAddress.zip),
      pickup_schedule_date: (() => {
        if (pickupSlot?.startTime) {
          const slotDate = new Date(pickupSlot.startTime);
          const now = new Date();
          // If slot date is in the past, use tomorrow instead
          return slotDate > now ? slotDate.toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
        // Default to tomorrow
        return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      })(),
      pickup_office_name: STATIC_ALT.alt_office_name,
      pickup_office_id: 21260721,
      
      // Additional required fields based on successful response
      mode_of_payment_cd: 'PS',
      pbe_no: 0,
      bulk_ref: 'Counter',
      receiver_gst_no: '',
      pickup_company_name: '',
      pickup_address_line1: '',
      pickup_address_line2: '',
      pickup_address_line3: '',
      pickup_city: '',
      pickup_state: '',
      pickup_pincode: 0,
      pickup_email_id: '',
      pickup_alt_contact_no: '',
      pickup_kyc_reference: '',
      pickup_tax_reference: '',
      pickup_mobile_no: 0,
      latitude: 0,
      longitude: 0,
    };

    const normalized = this.normalizeEmptyFields(transformedData);

    this.logger.log(
      `[India Post International createOrder] Transformed request payload: ${JSON.stringify(normalized)}`
    );

    return normalized;
  }

  private normalizeEmptyFields<T>(data: T): T {
    const normalize = (value: any): any => {
      if (value === null || value === undefined) return "";
      if (Array.isArray(value)) return value.map((item) => normalize(item));
      if (typeof value === "object") {
        const result: Record<string, any> = {};
        Object.keys(value).forEach((key) => {
          const v = (value as Record<string, any>)[key];
          result[key] = v === null || v === undefined ? "" : normalize(v);
        });
        return result;
      }
      return value;
    };

    return normalize(data);
  }

  private async callIndiaPostCreateOrderAPI(
    endpoint: any,
    payload: any,
  ): Promise<AxiosResponse<any>> {
    this.logger.debug("India Post International API call", JSON.stringify(payload));

    try {
      const authHeaders = await this.authProvider.getAuthHeaders();
      
      const response = await firstValueFrom(
        this.httpService.post(
          endpoint.url,
          payload,
          {
            headers: authHeaders,
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          }
        )
      );

      return response;
    } catch (error) {
      this.logger.error("India Post International API error", JSON.stringify(error.response?.data || error.message));
      throw error;
    }
  }

  private formatCreateOrderResponse<R extends BaseOrderResDto>(
    response: AxiosResponse<any>
  ): R {
    const responseData = response.data;

    if (responseData.error || responseData.status === 'error') {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `India Post API Error: ${responseData.error?.message || responseData.message || 'Unknown error'}`
      );
    }

    const trackingNumber = responseData.tracking_number || responseData.awb_number;
    const orderId = responseData.order_id || responseData.booking_id;
    const labelUrl = responseData.label_url;

    return {
      statusCode: 200,
      message: "Order created successfully with India Post International",
      partnerCode: this.partnerCode,
      metadata: {
        transporterId: responseData.transporter_id || responseData.transporterId || 'INDIA_POST_TRANSPORTER'
      },
      data: {
        originalResponse: responseData,
        trackingId: trackingNumber,
        referenceNumber: orderId,
        labelUrl: labelUrl || '',
        requestUrl: this.configService.get<string>('INDIA_POST_CREATE_ORDER_URL') || 'INDIA_POST_API',
        requestBody: responseData.request_body || responseData.requestBody || {},
        shipmentDetails: [
          {
            awbNumber: orderId || 'UNKNOWN',
            partnerAwbNumber: trackingNumber || 'UNKNOWN',
            partnerName: 'INDIA_POST_INTERNATIONAL',
            transporterId: responseData.transporter_id || responseData.transporterId || 'INDIA_POST_TRANSPORTER'
          }
        ]
      }
    } as R;
  }

  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(data: T): Promise<R> {
    try {
      const awbNumber = data.cAwbNumbers?.[0] || '';
      const endpoint = {
        url: `${this.configService.get<string>('INDIA_POST_BASE_URL')}/cancel/${awbNumber}`
      };

      if (!endpoint.url) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'INDIA_POST_BASE_URL environment variable is not configured'
        );
      }

      const authHeaders = await this.authProvider.getAuthHeaders();
      
      const response = await firstValueFrom(
        this.httpService.delete(endpoint.url, {
          headers: authHeaders,
          httpsAgent: this.httpsAgent,
          timeout: 30000,
        })
      );

      return {
        statusCode: 200,
        message: "Order cancelled successfully",
        partnerCode: this.partnerCode,
        metadata: {
          transporterId: 'INDIA_POST_TRANSPORTER'
        },
        data: response.data
      } as R;
    } catch (error) {
      this.logger.error(`India Post International cancelOrder error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    return this.cancelOrder<T, R>(data);
  }

  async updateOrderV2<T extends BaseUpdateOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      this.logger.debug(`India Post International updateOrderV2 called with order: ${data.orderId}`);
      
      // For now, throw an error as India Post International update order is not implemented
      throw new Error('India Post International updateOrderV2 not implemented');
    } catch (error) {
      this.logger.error(`India Post International updateOrderV2 failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `India Post International updateOrderV2 failed: ${error.message}`
      );
    }
  }

  async trackOrder(trackingNumber: string): Promise<any> {
    try {
      const endpoint = {
        url: `${this.configService.get<string>('INDIA_POST_BASE_URL')}/track/${trackingNumber}`
      };

      if (!endpoint.url) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'INDIA_POST_BASE_URL environment variable is not configured'
        );
      }

      const authHeaders = await this.authProvider.getAuthHeaders();
      
      const response = await firstValueFrom(
        this.httpService.get(endpoint.url, {
          headers: authHeaders,
          httpsAgent: this.httpsAgent,
          timeout: 30000,
        })
      );

      return {
        statusCode: 200,
        message: "Tracking information retrieved successfully",
        partnerCode: this.partnerCode,
        metadata: {
          transporterId: 'INDIA_POST_TRANSPORTER'
        },
        data: response.data
      };
    } catch (error) {
      this.logger.error(`India Post International trackOrder error: ${JSON.stringify(error)}`);
      throw error;
    }
  }
}


