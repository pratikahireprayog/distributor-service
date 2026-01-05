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
import { DpworldAuthService } from './dpworld-auth.service';
import {
  DpworldCreateShipmentRequestDto,
  DpworldCreateShipmentResponseDto,
  DpworldFormDataItem,
} from './dpworld.dto';
import { DPWORLD_ENV_KEYS, DPWORLD_DEFAULTS, DPWORLD_CONSTANTS } from './dpworld-constants';

/**
 * DPWORLD Network Partner Service
 * Implements order creation for DPWORLD logistics partner
 */
@Injectable()
export class DpworldService implements INetworkPartner {
  protected readonly logger = new Logger(DpworldService.name);

  constructor(
    private readonly dpworldAuthService: DpworldAuthService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create order V2 - Main implementation for DPWORLD
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      this.logger.debug(`DPWORLD createOrderV2 called with orderDetails: ${JSON.stringify(orderDetails)}`);
      
      if (!orderDetails) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Order details are required'
        );
      }

      const baseUrl = this.configService.get<string>(
        DPWORLD_ENV_KEYS.BASE_URL,
        DPWORLD_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        DPWORLD_ENV_KEYS.CREATE_ORDER_PATH,
        DPWORLD_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;

      // Transform the base order request to DPWORLD format
      const payload = this.transformToDpworldPayload(orderDetails);

      // Get authentication headers
      const authHeaders = await this.dpworldAuthService.getAuthHeaders();

      this.logger.log(`Creating order with DPWORLD: ${url}`);
      this.logger.debug(`Request payload: ${JSON.stringify(payload, null, 2)}`);

      const response = await firstValueFrom(
        this.httpService.post<DpworldCreateShipmentResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: DPWORLD_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`DPWORLD API returned status ${response.status}`, response.data);
        
        return {
          statusCode: response.status,
          message: `DPWORLD API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.DPWORLD,
          data: {
            originalResponse: response.data,
            requestUrl: url,
            requestBody: payload,
            error: true,
          },
        } as unknown as R;
      }

      const responseData = response.data;

      // Extract AWB number and relevant data from response
      const partnerAwbNumber =
        responseData?.data?.awbNumber ||
        responseData?.data?.trackingNumber ||
        payload.formData[0]?.awbNumber ||
        '';

      this.logger.log(`DPWORLD order created successfully. AWB: ${partnerAwbNumber}`);

      return {
        statusCode: 200,
        message: 'Order created successfully with DPWORLD',
        partnerCode: PARTNER_CODE_ENUM.DPWORLD,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          shipmentDetails: {
            trackingDetails: [
              {
                awbNumber: orderDetails.awbNumber || orderDetails.parentShipment?.awbNumber,
                partnerAwbNumber: partnerAwbNumber,
                partnerName: PARTNER_CODE_ENUM.DPWORLD,
                transporterId: 'DPWORLD',
              },
            ],
            documents: [],
          },
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`DPWORLD createOrderV2 failed: ${error.message}`, error.stack);
      
      const baseUrl = this.configService.get<string>(
        DPWORLD_ENV_KEYS.BASE_URL,
        DPWORLD_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        DPWORLD_ENV_KEYS.CREATE_ORDER_PATH,
        DPWORLD_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;

      return {
        statusCode: error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        message: `DPWORLD API error: ${error.message}`,
        partnerCode: PARTNER_CODE_ENUM.DPWORLD,
        data: {
          error: true,
          errorMessage: error.message,
          errorDetails: error.response?.data || error,
          requestUrl: url,
        },
      } as unknown as R;
    }
  }

  /**
   * Transform V2 order details to DPWORLD API format
   * Only includes fields with actual values to avoid "Invalid file" errors
   */
  private transformToDpworldPayload(orderDetails: BaseOrderReqDtoV2): DpworldCreateShipmentRequestDto {
    // Find pickup and delivery addresses
    const pickupAddress = orderDetails.addresses?.find(addr => addr.type === 'PICKUP');
    const deliveryAddress = orderDetails.addresses?.find(addr => addr.type === 'DELIVERY');

    // Get item details from parent shipment
    const items = orderDetails.parentShipment?.items || [];
    const firstItem = items.length > 0 ? items[0] : null;

    // Validate required field: awbNumber
    const awbNumber = orderDetails.parentShipment?.awbNumber || orderDetails.awbNumber;
    if (!awbNumber) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'awbNumber is required for DPWORLD shipment creation'
      );
    }

    // Normalize and validate AWB for DPWORLD (expects IATA Air Waybill: 3-digit airline prefix + 8-digit number)
    const normalizedAwb = String(awbNumber).replace(/\D/g, '');
    if (normalizedAwb.length !== 11) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'Invalid awbNumber format for DPWORLD. Expected 11-digit IATA AWB (e.g., 05705977031).'
      );
    }
    const airlinePrefix = normalizedAwb.substring(0, 3);
    this.logger.debug(`DPWORLD AWB prefix detected: ${airlinePrefix}`);

    // Format order date
    const orderDate = orderDetails.orderDate 
      ? new Date(orderDetails.orderDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Check if product data is provided
    const hasProductData = firstItem && (
      firstItem.sku || 
      firstItem.description || 
      firstItem.name || 
      firstItem.hsnCode || 
      firstItem.quantity !== undefined || 
      firstItem.unitPrice !== undefined
    );

    // Validate productNumber when product data is provided
    if (hasProductData && !firstItem?.sku) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'productNumber (sku) is required when product data is provided'
      );
    }

    // Build form data item dynamically, only adding fields with values
    const formDataItem: any = {
      awbNumber: normalizedAwb, // Required field - always include (numeric IATA AWB)
    };

    // Add optional fields only if they have values
    if (pickupAddress?.name) {
      formDataItem.shipper = pickupAddress.name;
    }
    
    if (deliveryAddress?.name) {
      formDataItem.consignee = deliveryAddress.name;
    }
    
    if (orderDetails.referenceId) {
      formDataItem.shipmentTags = orderDetails.referenceId;
    }
    
    if (orderDetails.orderId) {
      formDataItem.partnerOrgNumbers = orderDetails.orderId;
      formDataItem.poNumber = orderDetails.orderId;
      formDataItem.invoice_number = orderDetails.orderId;
    }
    
    if (orderDate) {
      formDataItem.order_date = orderDate;
    }

    // Add product data only if available and productNumber is present
    if (hasProductData && firstItem?.sku) {
      formDataItem.productNumber = firstItem.sku; // Required when product data is provided
      
      const productDesc = firstItem.description || firstItem.name;
      if (productDesc) {
        formDataItem.productDescription = productDesc;
      }
      
      if (firstItem.hsnCode) {
        formDataItem.hsCode = firstItem.hsnCode;
      }
      
      if (firstItem.quantity !== undefined && firstItem.quantity !== null) {
        formDataItem.productQuantity = firstItem.quantity;
        formDataItem.quantityUom = 'Units';
      }
      
      if (firstItem.unitPrice !== undefined && firstItem.unitPrice !== null) {
        formDataItem.unitPrice = firstItem.unitPrice;
        
        const currency = orderDetails.payment?.currency;
        if (currency) {
          formDataItem.priceCurrency = currency;
        }
      }
      
      if (orderDate) {
        formDataItem.productionDate = orderDate;
      }
    }

    this.logger.debug(`Transformed DPWORLD payload: ${JSON.stringify({ formData: [formDataItem], uploadType: DPWORLD_CONSTANTS.UPLOAD_TYPE }, null, 2)}`);

    return {
      formData: [formDataItem],
      uploadType: DPWORLD_CONSTANTS.UPLOAD_TYPE, // Required field
    };
  }

  // Stub implementations for other required interface methods
  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async createOrder<T extends any, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    throw new Error('Method not implemented. Use createOrderV2 instead.');
  }

  async getOrderDetails<T extends any, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async cancelOrder<T extends any, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async updateOrderV2<T extends any, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async pushOrderToDRS<T extends any, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async pushOrdersToPRS<T extends any, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async pushOrderToTracking<T extends any, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async manifestOrderToTracking<T extends any, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async updateEcomOrderWebhook<T extends any, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async createPickupV2<T extends any, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async cancelPickupV2<T extends any, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async pushOrderToHubOps<T extends any, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async pushOrderToHubOpsV2<T extends StandardRequestDto, R extends BaseResDto>(data: T): Promise<R> { return this.pushOrderToHubOps(data); }

  async updateOrderToHubOps<T extends any, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }

  async updatePartnerToHubOps<T extends any, R extends BaseResDto>(
    requestDto: T
  ): Promise<R> {
    throw new Error('Method not implemented for DPWORLD');
  }
}
