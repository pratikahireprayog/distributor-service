import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { INetworkPartner } from '../../interfaces/network-partner.interface';
import { BaseOrderResDto, BaseResDto, ManifestReqDto } from 'src/common/dtos/base.dto';
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from 'src/common/dtos/base2.dto';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { XpressbeesB2bAuthService } from './xpressbees_b2b-auth.service';
import {
  XpressbeesB2bCreateOrderRequestDto,
  XpressbeesB2bCreateOrderResponseDto,
  XpressbeesB2bCancelOrderRequestDto,
  XpressbeesB2bCancelOrderResponseDto,
  XpressbeesB2bCreateManifestRequestDto,
  XpressbeesB2bCreateManifestResponseDto,
  XpressbeesB2bProductDto,
  XpressbeesB2bInvoiceDto,
} from './xpressbees_b2b.dto';
import { XPRESSBEES_B2B_ENV_KEYS, XPRESSBEES_B2B_DEFAULTS, XPRESSBEES_B2B_CONSTANTS } from './xpressbees_b2b-constants';

@Injectable()
export class XpressbeesB2bService implements INetworkPartner {
  protected readonly logger = new Logger(XpressbeesB2bService.name);

  constructor(
    private readonly xpressbeesB2bAuthService: XpressbeesB2bAuthService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      this.logger.debug(`XpressBees B2B createOrderV2 called with orderDetails: ${JSON.stringify(orderDetails)}`);
      
      if (!orderDetails) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Order details are required'
        );
      }

      const baseUrl = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.BASE_URL,
        XPRESSBEES_B2B_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.CREATE_ORDER_PATH,
        XPRESSBEES_B2B_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;

      // Transform the base order request to XpressBees B2B format
      const payload = this.transformToXpressbeesB2bPayload(orderDetails);

      // Get authentication headers (same as B2C)
      const authHeaders = await this.xpressbeesB2bAuthService.getAuthHeaders();

      this.logger.log(`Creating order with XpressBees B2B: ${url}`);
      this.logger.log(`Using AWB Number for label generation: ${payload.id}`);
      this.logger.debug(`Request payload: ${JSON.stringify(payload, null, 2)}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesB2bCreateOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: XPRESSBEES_B2B_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`XpressBees B2B API returned status ${response.status}`, response.data);
        
        return {
          statusCode: response.status,
          message: `XpressBees B2B API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2B,
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
        message: 'Order created successfully with XpressBees B2B',
        partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2B,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          shipmentDetails: {
            trackingDetails: [
              {
                awbNumber: orderDetails.awbNumber || orderDetails.parentShipment?.awbNumber,
                partnerAwbNumber: partnerAwbNumber,
                partnerName: PARTNER_CODE_ENUM.XPRESSBEES_B2B,
                transporterId: 'XPRESSBEES_B2B',
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
      this.logger.error(`XpressBees B2B createOrderV2 failed: ${error.message}`, error.stack);
      
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.BASE_URL,
        XPRESSBEES_B2B_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.CREATE_ORDER_PATH,
        XPRESSBEES_B2B_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;
      
      let payload = null;
      try {
        payload = this.transformToXpressbeesB2bPayload(orderDetails);
      } catch (transformError) {
        this.logger.error(`Failed to transform payload for error response: ${transformError.message}`);
      }
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `XpressBees B2B createOrderV2 failed: ${error.message}`,
        {
          requestUrl: url,
          requestBody: payload,
          error: error.message,
          stack: error.stack,
        }
      );
    }
  }

private transformToXpressbeesB2bPayload(order: BaseOrderReqDtoV2): XpressbeesB2bCreateOrderRequestDto {
    this.logger.debug(`Transforming payload for XpressBees B2B, orderId: ${order?.orderId}`);
    
    // --- Input Validation (Retained) ---
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
            'Both PICKUP and DELIVERY addresses are required for XpressBees B2B'
        );
    }

    // --- Utility Functions (Retained) ---
    const parseAmount = (value: any): number => {
        const parsed = parseFloat(String(value || 0));
        return isNaN(parsed) ? 0 : parsed;
    };

    const getEffectiveWeight = (shipment: any): number => {
        const physicalWeight = parseAmount(shipment?.physicalWeight);
        const volumetricWeight = parseAmount(shipment?.volumetricWeight);
        return physicalWeight > 0 ? physicalWeight : (volumetricWeight || 0);
    };

    const sanitizeHsnCode = (hsn: any): string => {
        if (!hsn && hsn !== 0) return '5678';
        const hsnString = String(hsn);
        const numericOnly = hsnString.replace(/\D/g, '');
        return numericOnly || '5678';
    };

    const parentShipmentAny = order.parentShipment as any;
    const paymentAny = order.payment as any;
    const pickupAny = pickup as any;
    const deliveryAny = delivery as any;
    const metadataAny = order.metadata as any;

    // --- Aggregate order-level taxes for fallback ---
    const orderTaxesSum = (order.taxes || []).reduce((sum: number, tax: any) => {
        return sum + parseAmount(tax.value); 
    }, 0);
    
    // --- Collect Items from Both Parent and Child Shipments ---
    const allItems: any[] = [];
    
    // Add items from parentShipment
    if (order.parentShipment?.items && Array.isArray(order.parentShipment.items)) {
        allItems.push(...order.parentShipment.items);
    }
    
    // Add items from all childShipments
    if (order.childShipments && Array.isArray(order.childShipments)) {
        order.childShipments.forEach((childShipment: any) => {
            if (childShipment?.items && Array.isArray(childShipment.items)) {
                allItems.push(...childShipment.items);
            }
        });
    }
    
    this.logger.debug(`Collected ${allItems.length} items total (${order.parentShipment?.items?.length || 0} from parent, ${order.childShipments?.length || 0} child shipments)`);
    
    // --- Transform Products from Items ---
    const products: XpressbeesB2bProductDto[] = allItems.map((item: any) => {
        let taxPercentage = 0;
        
        if (item.taxes && item.taxes.length > 0) {
            const totalTax = item.taxes.reduce((sum: number, tax: any) => {
                return sum + parseAmount(tax.value);
            }, 0);
            taxPercentage = totalTax;
        } else if (orderTaxesSum > 0) {
            taxPercentage = orderTaxesSum;
        }

        const itemDimensions = item.dimensions || {};
        const hsnCode = sanitizeHsnCode(item.hsnCode);
        const productPrice = parseAmount(item.unitPrice) || 1;
        const productLength = parseAmount(itemDimensions.length) || 10;
        const productBreadth = parseAmount(itemDimensions.width) || 10;
        const productHeight = parseAmount(itemDimensions.height) || 10;
        
        return {
            product_name: item.name || '',
            product_qty: String(item.quantity || 1),
            product_price: String(productPrice),
            product_tax_per: String(taxPercentage),
            product_sku: item.sku || '',
            product_hsn_code: hsnCode,
            product_lbh_unit: 'cm',
            product_length: productLength,
            product_breadth: productBreadth,
            product_height: productHeight,
        };
    });

    // --- Calculate Amounts and Get E-Waybill Data ---
    const paymentMethod = paymentAny?.paymentMethod?.toLowerCase() || paymentAny?.type?.toLowerCase() || 'prepaid';
    const isPrepaid = paymentMethod === 'prepaid' || paymentMethod === 'online';
    
    const subTotal = parseAmount(paymentAny?.breakdown?.subTotal) || 0;
    
    let discount = 0;
    if (paymentAny?.breakdown?.discounts && Array.isArray(paymentAny.breakdown.discounts)) {
        discount = paymentAny.breakdown.discounts.reduce((sum: number, d: any) => {
            return sum + parseAmount(d.chargedAmount);
        }, 0);
    }
    
    const orderAmount = subTotal || parseAmount(paymentAny?.finalAmount) || 0;

    // E-Waybill data - from order.eWaybills (array of strings)
    // Format: ["491641801714", "491641801712"]
    const eWaybills = order.eWaybills || [];
    const primaryEbillNumber = Array.isArray(eWaybills) && eWaybills.length > 0 
      ? (typeof eWaybills[0] === 'string' ? eWaybills[0] : (eWaybills[0] as any)?.waybillNumber || null)
      : null;
    
    // Expiry date: 10 days after orderDate (no validUntil from string format)
    const orderDate = order.orderDate ? new Date(order.orderDate) : new Date();
    const expiryDate = new Date(orderDate);
    expiryDate.setDate(orderDate.getDate() + 10);
    const EbillExpiryDateCalculated = expiryDate.toISOString().split('T')[0];
    const formattedOrderDate = order.orderDate?.split('T')[0] || new Date().toISOString().split('T')[0];
    
    // --- Transform Invoices from Documents (DOCUMENTS USED ONLY FOR invoice_number/date/value) ---
    const invoiceDocs = order.documents?.filter((doc: any) => 
        doc.type && doc.type.toUpperCase() === 'INVOICE'
    ) || [];
    
    const numberOfInvoices = invoiceDocs.length || 1;
    const invoiceValuePerDoc = numberOfInvoices > 0 ? (orderAmount / numberOfInvoices) : orderAmount;
    
    const invoice: XpressbeesB2bInvoiceDto[] = invoiceDocs.map((doc: any) => {
        const invoiceDate = formattedOrderDate;
        
        const invoiceObj: any = {
            invoice_number: doc.number || '',
            invoice_date: invoiceDate,
            invoice_value: invoiceValuePerDoc,
        };
        
        // ✅ E-Waybill assignment: ONLY from order.eWaybills when invoice value >= 50000
        if (invoiceValuePerDoc >= 50000 && primaryEbillNumber) {
            invoiceObj.ebill_number = primaryEbillNumber;
            invoiceObj.ebill_expiry_date = EbillExpiryDateCalculated; // Always use calculated expiry (10 days from order date)
        }
        
        return invoiceObj;
    });

    // Default invoice when no documents exist
    if (invoice.length === 0) {
        const defaultInvoiceObj: any = {
            invoice_number: order.referenceId || order.orderId || '',
            invoice_date: formattedOrderDate,
            invoice_value: orderAmount,
        };
        
        if (orderAmount >= 50000 && primaryEbillNumber) {
            defaultInvoiceObj.ebill_number = primaryEbillNumber;
            defaultInvoiceObj.ebill_expiry_date = EbillExpiryDateCalculated; // Always use calculated expiry (10 days from order date)
        }

        invoice.push(defaultInvoiceObj);
    }
    
    // --- Get Dimensions and Weight (Sum from all shipments) ---
    let effectiveWeight = 0;
    
    // Add weight from parentShipment
    if (order.parentShipment) {
        effectiveWeight += getEffectiveWeight(order.parentShipment);
    }
    
    // Add weights from all childShipments
    if (order.childShipments && Array.isArray(order.childShipments)) {
        order.childShipments.forEach((childShipment: any) => {
            effectiveWeight += getEffectiveWeight(childShipment);
        });
    }
    
    // Default to 10 kg if no weight found
    if (effectiveWeight === 0) {
        effectiveWeight = 10;
    }

    const totalItemQuantity = allItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
    const ourAwbNumber = order.awbNumber || order.parentShipment?.awbNumber || order.orderId;
    
    this.logger.log(`AWB Number used for XpressBees B2B label: ${ourAwbNumber}`);
    this.logger.debug(`Transformed - Weight: ${effectiveWeight}kg, Order amount: ${orderAmount}, Products: ${products.length}, Invoices: ${invoice.length}`);

    // --- Final Payload Construction ---
    return {
        id: String(ourAwbNumber),
        payment_method: isPrepaid ? 'prepaid' : 'cod',
        consigner_name: pickup.name || '',
        consigner_phone: pickup.phone || '',
        consigner_pincode: pickup.zip || '',
        consigner_city: pickup.city || '',
        consigner_state: pickup.state || '',
        consigner_address: `${pickup.street || ''} ${pickup.landmark || ''}`.trim(),
        consigner_gst_number: metadataAny?.pickupGST || pickupAny?.gstNumber || parentShipmentAny?.sellerGstNumber || undefined,
        consignee_name: delivery.name || '',
        consignee_phone: delivery.phone || '',
        consignee_pincode: delivery.zip || '',
        consignee_city: delivery.city || '',
        consignee_state: delivery.state || '',
        consignee_address: `${delivery.street || ''} ${delivery.landmark || ''}`.trim(),
        consignee_gst_number: metadataAny?.deliveryGST || deliveryAny?.gstNumber || undefined,
        
        products: products,
        invoice: invoice,
        
        weight: effectiveWeight,
        courier_id: XPRESSBEES_B2B_CONSTANTS.COURIER_ID,
        pickup_location: 'customer',
        
        discount: discount || 0,
        order_amount: orderAmount || 0,
        no_of_invoices: invoice.length,
        no_of_boxes: totalItemQuantity || 1,
        global_weight_unit: 'kg',
    };
}


  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.BASE_URL,
        XPRESSBEES_B2B_DEFAULTS.BASE_URL
      );
      const cancelOrderPath = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.CANCEL_ORDER_PATH,
        XPRESSBEES_B2B_DEFAULTS.CANCEL_ORDER_PATH
      );
      const url = `${baseUrl}${cancelOrderPath}`;

      const awbNumber = data.cAwbNumbers?.[0] || data.orderId || '';

      if (!awbNumber) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'AWB number is required for cancellation'
        );
      }

      const payload: XpressbeesB2bCancelOrderRequestDto = {
        awb_number: awbNumber,
      };

      const authHeaders = await this.xpressbeesB2bAuthService.getAuthHeaders();

      this.logger.log(`Cancelling order with XpressBees B2B: ${url}`);
      this.logger.log(`Cancelling AWB Number: ${awbNumber}`);
      this.logger.debug(`Cancel request payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesB2bCancelOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: XPRESSBEES_B2B_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`XpressBees B2B cancel API returned status ${response.status}`, response.data);
        
        return {
          statusCode: response.status,
          message: `XpressBees B2B cancel API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2B,
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
        message: `Order cancelled successfully with XpressBees B2B for AWB: ${awbNumber}`,
        partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2B,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          awbNumber: awbNumber,
          cancelledAt: new Date().toISOString(),
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`XpressBees B2B cancelOrderV2 failed: ${error.message}`, error.stack);
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `XpressBees B2B cancelOrderV2 failed: ${error.message}`,
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
        XPRESSBEES_B2B_ENV_KEYS.BASE_URL,
        XPRESSBEES_B2B_DEFAULTS.BASE_URL
      );
      const manifestPath = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.CREATE_MANIFEST_PATH,
        XPRESSBEES_B2B_DEFAULTS.CREATE_MANIFEST_PATH
      );
      const url = `${baseUrl}${manifestPath}`;

      if (!manifestationDetails.awbNumbers || manifestationDetails.awbNumbers.length === 0) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'AWB numbers are required for manifest creation'
        );
      }

      const payload: XpressbeesB2bCreateManifestRequestDto = {
        awb_numbers: manifestationDetails.awbNumbers.join(','),
      };

      const authHeaders = await this.xpressbeesB2bAuthService.getAuthHeaders();

      this.logger.log(`Creating manifest with XpressBees B2B: ${url}`);
      this.logger.debug(`Manifest request payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesB2bCreateManifestResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: XPRESSBEES_B2B_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`XpressBees B2B manifest API returned status ${response.status}`, response.data);
        
        return {
          statusCode: response.status,
          message: `XpressBees B2B manifest API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2B,
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
        message: 'Manifest created successfully with XpressBees B2B',
        partnerCode: PARTNER_CODE_ENUM.XPRESSBEES_B2B,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          awbNumbers: manifestationDetails.awbNumbers,
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`XpressBees B2B createManifest failed: ${error.message}`, error.stack);
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `XpressBees B2B createManifest failed: ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
        }
      );
    }
  }

  async createOrder<T, R>(orderDetails: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Use createOrderV2 for XpressBees B2B');
  }

  async getOrderDetails<T, R>(params: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async cancelOrder<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Use cancelOrderV2 for XpressBees B2B');
  }

  async updateOrderV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async pushOrderToDRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async pushOrdersToPRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async pushOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async manifestOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async updateEcomOrderWebhook<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async createPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async cancelPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async pushOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async updateOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }

  async updatePartnerToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for XpressBees B2B');
  }
}

