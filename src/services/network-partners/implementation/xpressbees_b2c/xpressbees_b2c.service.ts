import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { INetworkPartner } from '../../interfaces/network-partner.interface';
import { BaseOrderResDto, BaseResDto, ManifestReqDto } from 'src/common/dtos/base.dto';
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from 'src/common/dtos/base2.dto';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { XpressbeesB2cAuthService } from './xpressbees_b2c-auth.service';
import {
  XpressbeesB2cCreateOrderRequestDto,
  XpressbeesB2cCreateOrderResponseDto,
  XpressbeesB2cCancelOrderRequestDto,
  XpressbeesB2cCancelOrderResponseDto,
  XpressbeesB2cCreateManifestRequestDto,
  XpressbeesB2cCreateManifestResponseDto,
  XpressbeesB2cProductDto,
  XpressbeesB2cInvoiceDto,
} from './xpressbees_b2c.dto';
import { XPRESSBEES_B2C_ENV_KEYS, XPRESSBEES_B2C_DEFAULTS, XPRESSBEES_B2C_CONSTANTS } from './xpressbees_b2c-constants';

@Injectable()
export class XpressbeesB2cService implements INetworkPartner {
  protected readonly logger = new Logger(XpressbeesB2cService.name);

  constructor(
    private readonly xpressbeesB2cAuthService: XpressbeesB2cAuthService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      this.logger.debug(`XpressBees B2C createOrderV2 called with orderDetails: ${JSON.stringify(orderDetails)}`);
      
      if (!orderDetails) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Order details are required'
        );
      }

      const baseUrl = this.configService.get<string>(
        XPRESSBEES_B2C_ENV_KEYS.BASE_URL,
        XPRESSBEES_B2C_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        XPRESSBEES_B2C_ENV_KEYS.CREATE_ORDER_PATH,
        XPRESSBEES_B2C_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;

      // Transform the base order request to XpressBees B2C format
      const payload = this.transformToXpressbeesB2cPayload(orderDetails);

      // Get authentication headers
      const authHeaders = await this.xpressbeesB2cAuthService.getAuthHeaders();

      this.logger.log(`Creating order with XpressBees B2C: ${url}`);
      this.logger.log(`Using AWB Number for label generation: ${payload.id}`);
      this.logger.debug(`Request payload: ${JSON.stringify(payload, null, 2)}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesB2cCreateOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: XPRESSBEES_B2C_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`XpressBees B2C API returned status ${response.status}`, response.data);
        
        return {
          statusCode: response.status,
          message: `XpressBees B2C API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2C,
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
      
      // Extract label URL from response
      const labelUrl = 
        responseData?.label ||
        responseData?.data?.label ||
        responseData?.data?.label_url ||
        '';

      this.logger.debug(`Response structure: ${JSON.stringify(responseData)}`);
      this.logger.log(`Label URL extracted for AWB ${payload.id}: ${labelUrl}`);

      return {
        statusCode: 200,
        message: 'Order created successfully with XpressBees B2C',
        partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2C,
        partnerOrderId: partnerAwbNumber || undefined, // Partner's internal order ID
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          partnerOrderId: partnerAwbNumber || undefined, // Also include in data for consistency
          shipmentDetails: {
            trackingDetails: [
              {
                awbNumber: orderDetails.awbNumber || orderDetails.parentShipment?.awbNumber,
                partnerAwbNumber: partnerAwbNumber,
                partnerName: PARTNER_CODE_ENUM.XPRESSBEES_B2C,
                transporterId: 'XPRESSBEES_B2C',
                partnerOrderId: partnerAwbNumber || undefined,
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
      this.logger.error(`XpressBees B2C createOrderV2 failed: ${error.message}`, error.stack);
      
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_B2C_ENV_KEYS.BASE_URL,
        XPRESSBEES_B2C_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        XPRESSBEES_B2C_ENV_KEYS.CREATE_ORDER_PATH,
        XPRESSBEES_B2C_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;
      
      let payload = null;
      try {
        payload = this.transformToXpressbeesB2cPayload(orderDetails);
      } catch (transformError) {
        this.logger.error(`Failed to transform payload for error response: ${transformError.message}`);
      }
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `XpressBees B2C createOrderV2 failed: ${error.message}`,
        {
          requestUrl: url,
          requestBody: payload,
          error: error.message,
          stack: error.stack,
        }
      );
    }
  }

  private transformToXpressbeesB2cPayload(order: BaseOrderReqDtoV2): XpressbeesB2cCreateOrderRequestDto {
    this.logger.debug(`Transforming payload for XpressBees B2C, orderId: ${order?.orderId}`);
    
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
            'Both PICKUP and DELIVERY addresses are required for XpressBees B2C'
        );
    }

    // --- Utility Functions ---

    const parseAmount = (value: any): number => {
        const parsed = parseFloat(String(value || 0));
        return isNaN(parsed) ? 0 : parsed;
    };

    // Calculate effective weight - use volumetric if physical is zero
    const getEffectiveWeight = (shipment: any): number => {
        const physicalWeight = parseAmount(shipment?.physicalWeight);
        const volumetricWeight = parseAmount(shipment?.volumetricWeight);
        return physicalWeight > 0 ? physicalWeight : (volumetricWeight || 0);
    };

    // Sanitize HSN code to only include numeric characters, use default if empty
    const sanitizeHsnCode = (hsn: any): string => {
        if (!hsn && hsn !== 0) return '5678'; // Return default HSN code if falsy
        const hsnString = String(hsn);
        const numericOnly = hsnString.replace(/\D/g, '');
        return numericOnly || '5678';
    };

    const parentShipmentAny = order.parentShipment as any;
    const paymentAny = order.payment as any;
    const pickupAny = pickup as any;
    const deliveryAny = delivery as any;
    
    // Extract charges from payment breakdown if available
    const getChargeFromBreakdown = (description: string): number => {
        const otherCharges = paymentAny?.breakdown?.otherCharges || [];
        const charge = otherCharges.find((c: any) => c.description === description);
        return parseAmount(charge?.chargedAmount);
    };

    // --- Transform Products from Items ---
    
    const items = order.parentShipment?.items || [];
    const products: XpressbeesB2cProductDto[] = items.map((item: any) => {
        // Calculate tax percentage from taxes array
        let taxPercentage = 0;
        if (item.taxes && item.taxes.length > 0) {
            const totalTax = item.taxes.reduce((sum: number, tax: any) => {
                return sum + parseAmount(tax.value);
            }, 0);
            taxPercentage = totalTax;
        }

        // Get and sanitize HSN code
        const hsnCode = sanitizeHsnCode(item.hsnCode);
        
        // Ensure product price is at least 1 (XpressBees requires positive amounts)
        const productPrice = parseAmount(item.unitPrice) || 1;
        
        return {
            product_name: item.name || '',
            product_qty: String(item.quantity || 1),
            product_price: String(productPrice),
            product_tax_per: String(taxPercentage), // Always include, even if 0
            product_sku: item.sku || '',
            product_hsn: hsnCode,
        };
    });

    // --- Transform Invoices from Documents ---
    
    const invoiceDocs = order.documents?.filter((doc: any) => 
        doc.type && doc.type.toUpperCase() === 'INVOICE'
    ) || [];
    
    const invoice: XpressbeesB2cInvoiceDto[] = invoiceDocs.map((doc: any) => {
        const docAny = doc as any;
        const invoiceDate = docAny.invoiceDate || order.orderDate?.split('T')[0] || new Date().toISOString().split('T')[0];
        
        return {
            invoice_number: doc.number || '',
            invoice_date: invoiceDate,
            ebill_number: docAny.ebillNumber || undefined,
            ebill_expiry_date: docAny.ebillExpiryDate || undefined,
        };
    });

    // If no invoice documents, create a default one
    if (invoice.length === 0) {
        invoice.push({
            invoice_number: order.referenceId || order.orderId || '',
            invoice_date: order.orderDate?.split('T')[0] || new Date().toISOString().split('T')[0],
        });
    }

    // --- Calculate Amounts ---
    
    const paymentMethod = paymentAny?.paymentMethod?.toLowerCase() || paymentAny?.type?.toLowerCase() || 'prepaid';
    const isPrepaid = paymentMethod === 'prepaid' || paymentMethod === 'online';
    
    // Get amounts from payment breakdown
    const subTotal = parseAmount(paymentAny?.breakdown?.subTotal) || 0;
    const shippingCharges = getChargeFromBreakdown('shipping') || 
                            getChargeFromBreakdown('freight') || 
                            getChargeFromBreakdown('freight_charge') || 
                            getChargeFromBreakdown('courier_charge') || 0;
    const codCharges = isPrepaid ? 0 : (getChargeFromBreakdown('cod') || getChargeFromBreakdown('cod_charges') || 0);
    
    // Calculate discount from breakdown
    let discount = 0;
    if (paymentAny?.breakdown?.discounts && Array.isArray(paymentAny.breakdown.discounts)) {
        discount = paymentAny.breakdown.discounts.reduce((sum: number, d: any) => {
            return sum + parseAmount(d.chargedAmount);
        }, 0);
    }
    
    const orderAmount = parseAmount(paymentAny?.finalAmount) || (subTotal + shippingCharges);
    const collectableAmount = isPrepaid ? 0 : orderAmount;
    
    // --- Get Dimensions and Weight ---

    const rawDimensions = order.parentShipment?.dimensions || { length: 12, width: 12, height: 12 };
    
    const dimensions = {
        length: parseAmount(rawDimensions.length) || 12,
        width: parseAmount(rawDimensions.width) || 12,
        height: parseAmount(rawDimensions.height) || 12,
    };

    const effectiveWeight = 
        getEffectiveWeight(order.parentShipment) ||
        getEffectiveWeight(order.childShipments?.[0]) ||
        700; // Default to 700 grams

    // Use AWB number as the order reference for label generation
    const ourAwbNumber = order.awbNumber || order.parentShipment?.awbNumber || order.orderId;
    
    this.logger.log(`AWB Number used for XpressBees label: ${ourAwbNumber}`);
    this.logger.debug(`Transformed - Weight: ${effectiveWeight}, Order amount: ${orderAmount}, Shipping: ${shippingCharges}, Products: ${products.length}, Invoices: ${invoice.length}`);

    // --- Final Payload Construction ---

    return {
        id: String(ourAwbNumber),
        unique_order_number: 'yes',
        payment_method: isPrepaid ? 'prepaid' : 'cod',
        consigner_name: pickup.name || '',
        consigner_phone: pickup.phone || '',
        consigner_pincode: pickup.zip || '',
        consigner_city: pickup.city || '',
        consigner_state: pickup.state || '',
        consigner_address: `${pickup.street || ''} ${pickup.landmark || ''}`.trim(),
        consigner_gst_number: pickupAny?.gstNumber || parentShipmentAny?.sellerGstNumber || undefined,
        consignee_name: delivery.name || '',
        consignee_phone: delivery.phone || '',
        consignee_pincode: delivery.zip || '',
        consignee_city: delivery.city || '',
        consignee_state: delivery.state || '',
        consignee_address: `${delivery.street || ''} ${delivery.landmark || ''}`.trim(),
        consignee_gst_number: deliveryAny?.gstNumber || undefined,
        
        products: products,
        invoice: invoice,
        
        weight: String(effectiveWeight), 
        length: String(dimensions.length),
        height: String(dimensions.height),
        breadth: String(dimensions.width),
        courier_id: XPRESSBEES_B2C_CONSTANTS.COURIER_ID, // Hardcoded as 16948
        pickup_location: XPRESSBEES_B2C_CONSTANTS.PICKUP_LOCATION,
        
        // All amount fields must be numeric strings (XpressBees requirement - never undefined)
        shipping_charges: String(shippingCharges || 0),
        cod_charges: String(codCharges || 0),
        discount: String(discount || 0),
        order_amount: String(orderAmount || 0),
        collectable_amount: String(collectableAmount || 0),
    };
}

  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_B2C_ENV_KEYS.BASE_URL,
        XPRESSBEES_B2C_DEFAULTS.BASE_URL
      );
      const cancelOrderPath = this.configService.get<string>(
        XPRESSBEES_B2C_ENV_KEYS.CANCEL_ORDER_PATH,
        XPRESSBEES_B2C_DEFAULTS.CANCEL_ORDER_PATH
      );
      const url = `${baseUrl}${cancelOrderPath}`;

      // Extract AWB number from child AWB numbers or order ID
      const awbNumber = data.cAwbNumbers?.[0] || data.orderId || '';

      if (!awbNumber) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'AWB number is required for cancellation'
        );
      }

      const payload: XpressbeesB2cCancelOrderRequestDto = {
        awb_number: awbNumber,
      };

      // Get authentication headers (same token used for create order)
      const authHeaders = await this.xpressbeesB2cAuthService.getAuthHeaders();

      this.logger.log(`Cancelling order with XpressBees B2C: ${url}`);
      this.logger.log(`Cancelling AWB Number: ${awbNumber}`);
      this.logger.debug(`Cancel request payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesB2cCancelOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: XPRESSBEES_B2C_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`XpressBees B2C cancel API returned status ${response.status}`, response.data);
        
        return {
          statusCode: response.status,
          message: `XpressBees B2C cancel API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2C,
          data: {
            originalResponse: response.data,
            requestUrl: url,
            requestBody: payload,
            error: true,
            awbNumber: awbNumber,
          },
        } as unknown as R;
      }

      this.logger.log(`Order cancelled successfully for AWB: ${awbNumber}`);

      return {
        statusCode: 200,
        message: `Order cancelled successfully with XpressBees B2C for AWB: ${awbNumber}`,
        partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2C,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          awbNumber: awbNumber,
          cancelledAt: new Date().toISOString(),
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`XpressBees B2C cancelOrderV2 failed: ${error.message}`, error.stack);
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `XpressBees B2C cancelOrderV2 failed: ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
        }
      );
    }
  }

  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    try {
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_B2C_ENV_KEYS.BASE_URL,
        XPRESSBEES_B2C_DEFAULTS.BASE_URL
      );
      const manifestPath = this.configService.get<string>(
        XPRESSBEES_B2C_ENV_KEYS.CREATE_MANIFEST_PATH,
        XPRESSBEES_B2C_DEFAULTS.CREATE_MANIFEST_PATH
      );
      const url = `${baseUrl}${manifestPath}`;

      if (!manifestationDetails.awbNumbers || manifestationDetails.awbNumbers.length === 0) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'AWB numbers are required for manifest creation'
        );
      }

      const payload: XpressbeesB2cCreateManifestRequestDto = {
        awb_numbers: manifestationDetails.awbNumbers.join(','),
      };

      const authHeaders = await this.xpressbeesB2cAuthService.getAuthHeaders();

      this.logger.log(`Creating manifest with XpressBees B2C: ${url}`);
      this.logger.debug(`Manifest request payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesB2cCreateManifestResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: XPRESSBEES_B2C_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`XpressBees B2C manifest API returned status ${response.status}`, response.data);
        
        return {
          statusCode: response.status,
          message: `XpressBees B2C manifest API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2C,
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
        message: 'Manifest created successfully with XpressBees B2C',
        partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2C,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          awbNumbers: manifestationDetails.awbNumbers,
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`XpressBees B2C createManifest failed: ${error.message}`, error.stack);
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `XpressBees B2C createManifest failed: ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
        }
      );
    }
  }

  async createOrder<T, R>(orderDetails: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Use createOrderV2 for XpressBees B2C');
  }

  async getOrderDetails<T, R>(params: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async cancelOrder<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Use cancelOrderV2 for XpressBees B2C');
  }

  async updateOrderV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async pushOrderToDRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async pushOrdersToPRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async pushOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async manifestOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async updateEcomOrderWebhook<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async createPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async cancelPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async pushOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async pushOrderToHubOpsV2<T, R>(data: T): Promise<R> { return this.pushOrderToHubOps(data); }

  async updateOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }

  async updatePartnerToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2C');
  }
}

