import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { INetworkPartner } from '../../interfaces/network-partner.interface';
import { BaseOrderResDto, BaseResDto, ManifestReqDto } from 'src/common/dtos/base.dto';
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from 'src/common/dtos/base2.dto';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { XpressbeesAuthService } from './xpressbees-auth.service';
import {
  XpressbeesCreateOrderRequestDto,
  XpressbeesCreateOrderResponseDto,
  XpressbessCancelOrderRequestDto,
  XpressbessCancelOrderResponseDto,
  XpressbeesCreateManifestRequestDto,
  XpressbeesCreateManifestResponseDto,
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
      this.logger.debug(`Request payload: ${JSON.stringify(payload, null, 2)}`);

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
        
        // Return error in same format as success for debugging
        return {
          statusCode: response.status,
          message: `Xpressbees API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.XPRESSBEES,
          data: {
            originalResponse: response.data,
            requestUrl: url,
            requestBody: payload,
            error: true,
          },
        } as unknown as R;
      }

      const responseData = response.data;

      // Extract AWB number from response
      const partnerAwbNumber =
        responseData?.awb_number ||
        responseData?.data?.awb_number ||
        responseData?.data?.order_id ||
        responseData?.data?.tracking_number ||
        '';

      this.logger.log(`Partner AWB Number extracted: ${partnerAwbNumber}`);
      
      // Extract label URL from response - similar to Baral
      const labelUrl = 
        responseData?.label ||              // Xpressbees returns in "label" field at root level
        responseData?.data?.label ||        // Or nested in data
        responseData?.data?.label_url ||    // Or as label_url in data
        '';

      this.logger.debug(`Response structure: ${JSON.stringify(responseData)}`);
      this.logger.log(`Label URL extracted: ${labelUrl}`);

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
                partnerAwbNumber: partnerAwbNumber,
                partnerName: PARTNER_CODE_ENUM.XPRESSBEES,
                transporterId: 'XPRESSBEES',
              },
            ],
            documents: [
              {
                content: labelUrl,
                type: 'label',
                format: 's3link',
              },
            ],
          },
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`Xpressbees createOrderV2 failed: ${error.message}`, error.stack);
      
      // Try to include request details in error response
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.BASE_URL,
        XPRESSBEES_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.CREATE_ORDER_PATH,
        XPRESSBEES_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;
      
      let payload = null;
      try {
        payload = this.transformToXpressbeesPayload(orderDetails);
      } catch (transformError) {
        this.logger.error(`Failed to transform payload for error response: ${transformError.message}`);
      }
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Xpressbees createOrderV2 failed: ${error.message}`,
        {
          requestUrl: url,
          requestBody: payload,
          error: error.message,
          stack: error.stack,
        }
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
    const products: XpressbeesProductDto[] = (order.parentShipment?.items || []).map((item) => {
      const unitPrice = parseFloat(String(item.unitPrice || 0)) || 0;
      const taxPercentage = (item as any).taxPercentage ? parseFloat(String((item as any).taxPercentage)) || 0 : 0;
      
      // If unit price is 0, try to calculate from payment breakdown or use a minimum value
      const finalUnitPrice = unitPrice > 0 ? unitPrice : 1;
      
      return {
        product_name: item.name || item.description || 'Product',
        product_qty: String(item.quantity || 1),
        product_price: String(finalUnitPrice),
        product_tax_per: taxPercentage > 0 ? String(taxPercentage) : '0',
        product_sku: String(item.sku || (item as any).id || 'SKU001'),
        product_hsn: item.hsnCode || '0',
      };
    });

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

    // Calculate amounts - ensure all amounts are valid numbers
    const parseAmount = (value: any): number => {
      const parsed = parseFloat(String(value || 0));
      return isNaN(parsed) ? 0 : parsed;
    };

    // Extract charges from payment breakdown if available
    const getChargeFromBreakdown = (description: string): number => {
      const otherCharges = paymentAny?.breakdown?.otherCharges || [];
      const charge = otherCharges.find((c: any) => c.description === description);
      return parseAmount(charge?.chargedAmount);
    };

    const orderAmount = parseAmount(order.payment?.finalAmount || paymentAny?.totalAmount);
    const collectableAmount = 0; // Always 0 for prepaid
    const shippingCharges = parseAmount(paymentAny?.shippingCharges) || getChargeFromBreakdown('freight_charge') || 0;
    const codCharges = parseAmount(paymentAny?.codCharges) || getChargeFromBreakdown('cod_charges') || 0;
    const discount = parseAmount(paymentAny?.discount) || parseAmount(paymentAny?.breakdown?.discounts?.[0]?.chargedAmount) || 0;

    // Get dimensions from first child shipment or parent
    const rawDimensions =
      order.childShipments?.[0]?.dimensions || order.parentShipment?.dimensions || { length: 10, width: 10, height: 10 };
    
    // Parse dimensions to ensure they're numeric
    const dimensions = {
      length: parseFloat(String(rawDimensions.length || 10)) || 10,
      width: parseFloat(String(rawDimensions.width || 10)) || 10,
      height: parseFloat(String(rawDimensions.height || 10)) || 10,
    };

    const pickupAny = pickup as any;
    const deliveryAny = delivery as any;
    
    // Calculate effective weight - use volumetric if physical is zero
    const getEffectiveWeight = (shipment: any): number => {
      const physicalWeight = parseFloat(String(shipment?.physicalWeight || 0));
      const volumetricWeight = parseFloat(String(shipment?.volumetricWeight || 0));
      return physicalWeight > 0 ? physicalWeight : (volumetricWeight || 0);
    };

    const effectiveWeight = 
      getEffectiveWeight(order.parentShipment) ||
      getEffectiveWeight(order.childShipments?.[0]) ||
      500;

    this.logger.debug(`Effective weight calculated: ${effectiveWeight}, Order amount: ${orderAmount}, Shipping: ${shippingCharges}`);
    
    // Use our AWB number as the order reference on the label
    const ourAwbNumber = order.awbNumber || order.parentShipment?.awbNumber || order.orderId;
    this.logger.log(`Using AWB number for label Order No: ${ourAwbNumber}`);
    
    return {
      id: String(ourAwbNumber),
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
      weight: String(effectiveWeight),
      length: String(dimensions.length || 10),
      height: String(dimensions.height || 10),
      breadth: String(dimensions.width || 10),
      courier_id: this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.COURIER_ID,
        XPRESSBEES_DEFAULTS.COURIER_ID
      ),
      pickup_location: XPRESSBEES_CONSTANTS.PICKUP_LOCATION,
      shipping_charges: String(shippingCharges),
      cod_charges: String(codCharges),
      discount: String(discount),
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
        
        // Return error in same format as success for debugging
        return {
          statusCode: response.status,
          message: `Xpressbees cancel API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.XPRESSBEES,
          data: {
            originalResponse: response.data,
            requestUrl: url,
            requestBody: payload,
            error: true,
            awbNumber: awbNumber,
          },
        } as unknown as R;
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
      
      // Try to include request details in error response
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.BASE_URL,
        XPRESSBEES_DEFAULTS.BASE_URL
      );
      const cancelOrderPath = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.CANCEL_ORDER_PATH,
        XPRESSBEES_DEFAULTS.CANCEL_ORDER_PATH
      );
      const url = `${baseUrl}${cancelOrderPath}`;
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Xpressbees cancelOrderV2 failed: ${error.message}`,
        {
          requestUrl: url,
          requestBody: {
            awb_number: data.cAwbNumbers?.[0] || data.orderId || '',
          },
          error: error.message,
          stack: error.stack,
        }
      );
    }
  }

  // Create Manifest implementation
  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    try {
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.BASE_URL,
        XPRESSBEES_DEFAULTS.BASE_URL
      );
      const manifestPath = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.CREATE_MANIFEST_PATH,
        XPRESSBEES_DEFAULTS.CREATE_MANIFEST_PATH
      );
      const url = `${baseUrl}${manifestPath}`;

      // Validate AWB numbers
      if (!manifestationDetails.awbNumbers || manifestationDetails.awbNumbers.length === 0) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'AWB numbers are required for manifest creation'
        );
      }

      // Join AWB numbers with comma as per API requirement
      const payload: XpressbeesCreateManifestRequestDto = {
        awb_numbers: manifestationDetails.awbNumbers.join(','),
      };

      // Get authentication headers
      const authHeaders = await this.xpressbeesAuthService.getAuthHeaders();

      this.logger.log(`Creating manifest with Xpressbees: ${url}`);
      this.logger.debug(`Manifest request payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesCreateManifestResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: XPRESSBEES_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`Xpressbees manifest API returned status ${response.status}`, response.data);
        
        // Return error in same format as success for debugging
        return {
          statusCode: response.status,
          message: `Xpressbees manifest API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.XPRESSBEES,
          data: {
            originalResponse: response.data,
            requestUrl: url,
            requestBody: payload,
            error: true,
            awbNumbers: manifestationDetails.awbNumbers,
          },
        } as unknown as R;
      }

      return {
        statusCode: 200,
        message: 'Manifest created successfully with Xpressbees',
        partnerCode: PARTNER_CODE_ENUM.XPRESSBEES,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          awbNumbers: manifestationDetails.awbNumbers,
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`Xpressbees createManifest failed: ${error.message}`, error.stack);
      
      // Try to include request details in error response
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.BASE_URL,
        XPRESSBEES_DEFAULTS.BASE_URL
      );
      const manifestPath = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.CREATE_MANIFEST_PATH,
        XPRESSBEES_DEFAULTS.CREATE_MANIFEST_PATH
      );
      const url = `${baseUrl}${manifestPath}`;
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Xpressbees createManifest failed: ${error.message}`,
        {
          requestUrl: url,
          requestBody: {
            awb_numbers: manifestationDetails.awbNumbers?.join(',') || '',
          },
          error: error.message,
          stack: error.stack,
        }
      );
    }
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
