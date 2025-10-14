import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { INetworkPartner } from '../../interfaces/network-partner.interface';
import { BaseOrderResDto, BaseResDto } from 'src/common/dtos/base.dto';
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from 'src/common/dtos/base2.dto';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { XpressbeesAuthService } from './xpressbees-auth.service';
import {
  XpressbeesCreateOrderRequestDto,
  XpressbeesCreateOrderResponseDto,
  XpressbessCancelOrderRequestDto,
  XpressbessCancelOrderResponseDto,
  XpressbeesProductDto,
  XpressbeesInvoiceDto,
} from './xpressbees.dto';
import { XPRESSBEES_ENV_KEYS, XPRESSBEES_DEFAULTS, XPRESSBEES_CONSTANTS } from './xpressbees-constants';

@Injectable()
export class XpressbeesService implements INetworkPartner {
  protected readonly logger = new Logger(XpressbeesService.name);

  constructor(
    private readonly xpressbeesAuthService: XpressbeesAuthService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      this.logger.debug(`Xpressbees createOrderV2 called with orderDetails: ${JSON.stringify(orderDetails)}`);
      
      if (!orderDetails) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Order details are required'
        );
      }

      const baseUrl = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.BASE_URL,
        XPRESSBEES_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.CREATE_ORDER_PATH,
        XPRESSBEES_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;

      // Transform the base order request to Xpressbees format
      const payload = this.transformToXpressbeesPayload(orderDetails);

      // Get authentication headers
      const authHeaders = await this.xpressbeesAuthService.getAuthHeaders();

      this.logger.log(`Creating order with Xpressbees: ${url}`);
      this.logger.debug(`Request payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesCreateOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: XPRESSBEES_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`Xpressbees API returned status ${response.status}`, response.data);
        throw new CustomHttpException(
          HttpStatus.BAD_GATEWAY,
          `Xpressbees API returned status ${response.status}: ${JSON.stringify(response.data)}`
        );
      }

      const responseData = response.data;
      const responseDataAny = responseData as any;

      // Extract AWB number from response - prioritize awb_number from originalResponse
      const partnerAwbNumber =
        responseDataAny?.awb_number ||
        responseData?.data?.awb_number ||
        responseData?.data?.order_id ||
        responseData?.data?.tracking_number ||
        responseDataAny?.order_id ||
        '';

      this.logger.log(`Partner AWB Number extracted: ${partnerAwbNumber}`);
      this.logger.debug(`Response structure: ${JSON.stringify(responseData)}`);

      return {
        statusCode: 200,
        message: 'Order created successfully with Xpressbees',
        partnerCode: PARTNER_CODE_ENUM.XPRESSBEES,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          shipmentDetails: {
            trackingDetails: [
              {
                awbNumber: orderDetails.parentShipment?.awbNumber || orderDetails.awbNumber,
                partnerAwbNumber: partnerAwbNumber, // This is from originalResponse.awb_number
                partnerName: PARTNER_CODE_ENUM.XPRESSBEES,
                transporterId: 'XPRESSBEES',
              },
            ],
            documents: responseData?.data?.label_url || responseDataAny?.label_url
              ? [
                  {
                    content: responseData?.data?.label_url || responseDataAny?.label_url,
                    type: 'label',
                    format: 'PDF',
                  },
                ]
              : [],
          },
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`Xpressbees createOrderV2 failed: ${error.message}`, error.stack);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Xpressbees createOrderV2 failed: ${error.message}`
      );
    }
  }

  private transformToXpressbeesPayload(order: BaseOrderReqDtoV2): XpressbeesCreateOrderRequestDto {
    this.logger.debug(`Transforming payload for Xpressbees, orderId: ${order?.orderId}`);
    
    if (!order) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'Order data is missing'
      );
    }

    if (!order.addresses || !Array.isArray(order.addresses)) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'Addresses array is missing or invalid'
      );
    }

    // Find pickup and delivery addresses
    const pickup = order.addresses.find((a) => a.type === 'PICKUP');
    const delivery = order.addresses.find((a) => a.type === 'DELIVERY');

    if (!pickup || !delivery) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'Both PICKUP and DELIVERY addresses are required for Xpressbees'
      );
    }

    // Transform products
    const products: XpressbeesProductDto[] = (order.parentShipment?.items || []).map((item) => ({
      product_name: item.name || item.description || 'Product',
      product_qty: String(item.quantity || 1),
      product_price: String(item.unitPrice || 0),
      product_tax_per: (item as any).taxPercentage ? String((item as any).taxPercentage) : '',
      product_sku: String(item.sku || (item as any).id || 'SKU001'),
      product_hsn: item.hsnCode || '',
    }));

    // Transform invoice details
    const parentShipmentAny = order.parentShipment as any;
    const invoice: XpressbeesInvoiceDto[] = [
      {
        invoice_number: parentShipmentAny?.invoiceNumber || order.orderId || 'INV001',
        invoice_date: parentShipmentAny?.invoiceDate || new Date().toISOString().split('T')[0],
        ebill_number: parentShipmentAny?.ewaybillNumber || '',
        ebill_expiry_date: parentShipmentAny?.ewaybillExpiryDate || '',
      },
    ];

    // Always use prepaid as payment method (lowercase required by API)
    const paymentAny = order.payment as any;
    const paymentMethod = 'prepaid';

    // Calculate amounts
    const orderAmount = order.payment?.finalAmount || paymentAny?.totalAmount || 0;
    const collectableAmount = 0; // Always 0 for prepaid

    // Get dimensions from first child shipment or parent
    const dimensions =
      order.childShipments?.[0]?.dimensions || order.parentShipment?.dimensions || { length: 10, width: 10, height: 10 };

    const pickupAny = pickup as any;
    const deliveryAny = delivery as any;
    
    return {
      id: String(order.orderId || (order.parentShipment as any)?.id || Date.now()),
      unique_order_number: 'yes',
      payment_method: paymentMethod,
      consigner_name: pickup.name || '',
      consigner_phone: pickup.phone || '',
      consigner_pincode: pickup.zip || '',
      consigner_city: pickup.city || '',
      consigner_state: pickup.state || '',
      consigner_address: `${pickup.street || ''} ${pickup.landmark || ''}`.trim(),
      consigner_gst_number: pickupAny?.gstNumber || parentShipmentAny?.sellerGstNumber || '',
      consignee_name: delivery.name || '',
      consignee_phone: delivery.phone || '',
      consignee_pincode: delivery.zip || '',
      consignee_city: delivery.city || '',
      consignee_state: delivery.state || '',
      consignee_address: `${delivery.street || ''} ${delivery.landmark || ''}`.trim(),
      consignee_gst_number: deliveryAny?.gstNumber || '',
      products: products,
      invoice: invoice,
      weight: String(
        order.parentShipment?.physicalWeight ||
        order.childShipments?.[0]?.physicalWeight ||
        500
      ),
      length: String(dimensions.length || 10),
      height: String(dimensions.height || 10),
      breadth: String(dimensions.width || 10),
      courier_id: this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.COURIER_ID,
        XPRESSBEES_DEFAULTS.COURIER_ID
      ),
      pickup_location: XPRESSBEES_CONSTANTS.PICKUP_LOCATION,
      shipping_charges: String(paymentAny?.shippingCharges || 0),
      cod_charges: String(paymentAny?.codCharges || 0),
      discount: String(paymentAny?.discount || 0),
      order_amount: String(orderAmount),
      collectable_amount: String(collectableAmount),
    };
  }

  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.BASE_URL,
        XPRESSBEES_DEFAULTS.BASE_URL
      );
      const cancelOrderPath = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.CANCEL_ORDER_PATH,
        XPRESSBEES_DEFAULTS.CANCEL_ORDER_PATH
      );
      const url = `${baseUrl}${cancelOrderPath}`;

      // Get the AWB number to cancel
      const awbNumber = data.cAwbNumbers?.[0] || data.orderId || '';

      if (!awbNumber) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'AWB number is required for cancellation'
        );
      }

      const payload: XpressbessCancelOrderRequestDto = {
        awb_number: awbNumber,
      };

      // Get authentication headers
      const authHeaders = await this.xpressbeesAuthService.getAuthHeaders();

      this.logger.log(`Cancelling order with Xpressbees: ${url}`);
      this.logger.debug(`Cancel request payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbessCancelOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: XPRESSBEES_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`Xpressbees cancel API returned status ${response.status}`, response.data);
        throw new CustomHttpException(
          HttpStatus.BAD_GATEWAY,
          `Xpressbees cancel API returned status ${response.status}: ${JSON.stringify(response.data)}`
        );
      }

      return {
        statusCode: 200,
        message: 'Order cancelled successfully with Xpressbees',
        partnerCode: PARTNER_CODE_ENUM.XPRESSBEES,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          awbNumber: awbNumber,
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`Xpressbees cancelOrderV2 failed: ${error.message}`, error.stack);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Xpressbees cancelOrderV2 failed: ${error.message}`
      );
    }
  }

  // Stub implementations for INetworkPartner interface methods
  async createManifest<T, R>(manifestationDetails: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async createOrder<T, R>(orderDetails: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Use createOrderV2 for Xpressbees');
  }

  async getOrderDetails<T, R>(params: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async cancelOrder<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Use cancelOrderV2 for Xpressbees');
  }

  async updateOrderV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async pushOrderToDRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async pushOrdersToPRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async pushOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async manifestOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async updateEcomOrderWebhook<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async createPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async cancelPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async pushOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async updateOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }

  async updatePartnerToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Xpressbees');
  }
}
