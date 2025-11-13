import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { INetworkPartner } from '../../interfaces/network-partner.interface';
import { BaseOrderResDto, BaseResDto, ManifestReqDto } from 'src/common/dtos/base.dto';
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from 'src/common/dtos/base2.dto';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { EkartAuthService } from './ekart-auth.service';
import {
  EkartCreateOrderRequestDto,
  EkartCreateOrderResponseDto,
  EkartLbhDataDto,
  EkartInvoiceDetailsDto,
  EkartConsignorDto,
  EkartConsigneeDto,
} from './ekart.dto';
import { EKART_ENV_KEYS, EKART_DEFAULTS, EKART_CONSTANTS } from './ekart-constants';

@Injectable()
export class EkartService implements INetworkPartner {
  protected readonly logger = new Logger(EkartService.name);

  constructor(
    private readonly ekartAuthService: EkartAuthService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      this.logger.debug(`Ekart createOrderV2 called with orderDetails: ${JSON.stringify(orderDetails)}`);
      
      if (!orderDetails) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Order details are required'
        );
      }

      const baseUrl = this.configService.get<string>(
        EKART_ENV_KEYS.BASE_URL,
        EKART_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        EKART_ENV_KEYS.CREATE_ORDER_PATH,
        EKART_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;

      // Transform the base order request to Ekart format
      const payload = this.transformToEkartPayload(orderDetails);

      // Get authentication headers
      const authHeaders = await this.ekartAuthService.getAuthHeaders();

      this.logger.log(`Creating order with Ekart: ${url}`);
      this.logger.debug(`Request payload: ${JSON.stringify(payload, null, 2)}`);

      const response = await firstValueFrom(
        this.httpService.post<EkartCreateOrderResponseDto>(url, payload, {
          headers: authHeaders,
          timeout: EKART_CONSTANTS.DEFAULT_TIMEOUT,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`Ekart API returned status ${response.status}`, response.data);
        
        return {
          statusCode: response.status,
          message: `Ekart API returned error: ${response.data?.message || JSON.stringify(response.data)}`,
          partnerCode: PARTNER_CODE_ENUM.EKART,
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
        responseData?.awbNumber ||
        responseData?.data?.awbNumber ||
        responseData?.data?.orderId ||
        responseData?.data?.trackingNumber ||
        responseData?.docketNo ||
        '';

      this.logger.log(`Partner AWB Number extracted: ${partnerAwbNumber}`);

      return {
        statusCode: 200,
        message: 'Order created successfully with Ekart',
        partnerCode: PARTNER_CODE_ENUM.EKART,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          shipmentDetails: {
            trackingDetails: [
              {
                awbNumber: orderDetails.awbNumber || orderDetails.parentShipment?.awbNumber,
                partnerAwbNumber: partnerAwbNumber,
                partnerName: PARTNER_CODE_ENUM.EKART,
                transporterId: 'EKART',
              },
            ],
          },
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`Ekart createOrderV2 failed: ${error.message}`, error.stack);
      
      const baseUrl = this.configService.get<string>(
        EKART_ENV_KEYS.BASE_URL,
        EKART_DEFAULTS.BASE_URL
      );
      const createOrderPath = this.configService.get<string>(
        EKART_ENV_KEYS.CREATE_ORDER_PATH,
        EKART_DEFAULTS.CREATE_ORDER_PATH
      );
      const url = `${baseUrl}${createOrderPath}`;
      
      let payload = null;
      try {
        payload = this.transformToEkartPayload(orderDetails);
      } catch (transformError) {
        this.logger.error(`Failed to transform payload for error response: ${transformError.message}`);
      }
      
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Ekart createOrderV2 failed: ${error.message}`,
        {
          requestUrl: url,
          requestBody: payload,
          error: error.message,
          stack: error.stack,
        }
      );
    }
  }

  private transformToEkartPayload(order: BaseOrderReqDtoV2): EkartCreateOrderRequestDto {
    this.logger.debug(`Transforming payload for Ekart, orderId: ${order?.orderId}`);
    
    // Input Validation
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
            'Both PICKUP and DELIVERY addresses are required for Ekart'
        );
    }

    // Utility Functions
    const parseAmount = (value: any): number => {
        const parsed = parseFloat(String(value || 0));
        return isNaN(parsed) ? 0 : parsed;
    };

    const getEffectiveWeight = (shipment: any): number => {
        const physicalWeight = parseAmount(shipment?.physicalWeight);
        const volumetricWeight = parseAmount(shipment?.volumetricWeight);
        return physicalWeight > 0 ? physicalWeight : (volumetricWeight || 0);
    };

    // Collect Items from Both Parent and Child Shipments
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

    // Calculate total weight from all shipments
    let totalWeight = 0;
    if (order.parentShipment) {
        totalWeight += getEffectiveWeight(order.parentShipment);
    }
    if (order.childShipments && Array.isArray(order.childShipments)) {
        order.childShipments.forEach((childShipment: any) => {
            totalWeight += getEffectiveWeight(childShipment);
        });
    }
    if (totalWeight === 0) {
        totalWeight = 10; // Default to 10 kg
    }

    // Build lbhData from shipments
    const lbhData: EkartLbhDataDto[] = [];
    
    // Add parent shipment dimensions
    if (order.parentShipment) {
        const parentWeight = getEffectiveWeight(order.parentShipment);
        const parentDimensions = order.parentShipment.dimensions || {} as any;
        const parentItems = order.parentShipment.items || [];
        const packetCount = parentItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 1;
        
        lbhData.push({
            packetCount: packetCount,
            packetLength: String(parseAmount((parentDimensions as any).length) || 5),
            packetWidth: String(parseAmount((parentDimensions as any).width) || 5),
            packetHeight: String(parseAmount((parentDimensions as any).height) || 5),
            packetNo: null,
            customerPacketRefNo: null, // Set to null as per requirement
            actualWeight: String(parentWeight || totalWeight / (order.childShipments?.length || 1) + 1),
            invoiceNo: null,
        });
    }

    // Add child shipments dimensions
    if (order.childShipments && Array.isArray(order.childShipments)) {
        order.childShipments.forEach((childShipment: any) => {
            const childWeight = getEffectiveWeight(childShipment);
            const childDimensions = childShipment.dimensions || {} as any;
            const childItems = childShipment.items || [];
            const packetCount = childItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 1;
            
            lbhData.push({
                packetCount: packetCount,
                packetLength: String(parseAmount((childDimensions as any).length) || 5),
                packetWidth: String(parseAmount((childDimensions as any).width) || 5),
                packetHeight: String(parseAmount((childDimensions as any).height) || 5),
                packetNo: null,
                customerPacketRefNo: null, // Set to null as per requirement
                actualWeight: String(childWeight || 1),
                invoiceNo: null,
            });
        });
    }

    // If no shipments, create default lbhData
    if (lbhData.length === 0) {
        lbhData.push({
            packetCount: 1,
            packetLength: "5",
            packetWidth: "5",
            packetHeight: "5",
            packetNo: null,
            customerPacketRefNo: null, // Set to null as per requirement
            actualWeight: String(totalWeight),
            invoiceNo: null,
        });
    }

    // Calculate total packet count
    const totalPacketCount = lbhData.reduce((sum, lbh) => sum + lbh.packetCount, 0);

    // Build invoice details
    const invoiceDetails: EkartInvoiceDetailsDto[] = [];
    const invoiceDocs = order.documents?.filter((doc: any) => 
        doc.type && doc.type.toUpperCase() === 'INVOICE'
    ) || [];

    const paymentAny = order.payment as any;
    const subTotal = parseAmount(paymentAny?.breakdown?.subTotal) || 0;
    const orderAmount = subTotal || parseAmount(paymentAny?.finalAmount) || 0;

    // Format order date for invoice (DD-MM-YYYY)
    const orderDate = order.orderDate ? new Date(order.orderDate) : new Date();
    const formattedOrderDate = `${String(orderDate.getDate()).padStart(2, '0')}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${orderDate.getFullYear()}`;
    
    // Calculate e-waybill expiry date (10 days after order date)
    const ewbExpiryDate = new Date(orderDate);
    ewbExpiryDate.setDate(orderDate.getDate() + 10);
    const formattedEwbExpiryDate = `${String(ewbExpiryDate.getDate()).padStart(2, '0')}-${String(ewbExpiryDate.getMonth() + 1).padStart(2, '0')}-${ewbExpiryDate.getFullYear()}`;

    // Get e-waybill from order.eWaybills (first one) - used for master invoice
    const eWaybills = order.eWaybills || [];
    const ewbNo = Array.isArray(eWaybills) && eWaybills.length > 0 
        ? (typeof eWaybills[0] === 'string' ? eWaybills[0] : (eWaybills[0] as any)?.waybillNumber || null)
        : null;

    // Ekart requires single master invoice (not separate invoices per document)
    // Use first invoice document number or referenceId/orderId as master invoice number
    const masterInvoiceNo = invoiceDocs.length > 0 
        ? (invoiceDocs[0]?.number || order.referenceId || order.orderId)
        : (order.referenceId || order.orderId || '');

    // Create single master invoice
    invoiceDetails.push({
        invoiceNo: masterInvoiceNo,
        invoiceAmount: subTotal, // Map to subTotal field
        ewbNo: ewbNo, // From eWaybills array
        invoiceDate: formattedOrderDate, // From orderDate
        ewbDate: formattedOrderDate, // From orderDate
        ewbValidTill: formattedEwbExpiryDate, // 10 days after orderDate
    });

    // Build consignor (pickup address)
    const consignor: EkartConsignorDto = {
        consignorCode: '',
        consignorPincode: pickup.zip || '',
        consignorName: pickup.name || '',
        address1: `${pickup.street || ''} ${pickup.landmark || ''}`.trim() || pickup.city || '',
        city: pickup.city || '',
        state: pickup.state || '',
        contactName: pickup.name || '',
        contactPhoneno: pickup.phone || '',
        email: '',
    };

    // Build consignee (delivery address)
    const consignee: EkartConsigneeDto = {
        consigneeCode: '',
        consigneePincode: delivery.zip || '',
        consigneeName: delivery.name || '',
        address1: `${delivery.street || ''} ${delivery.landmark || ''}`.trim() || delivery.city || '',
        city: delivery.city || '',
        state: delivery.state || '',
        contactName: delivery.name || '',
        contactPhoneno: delivery.phone || '',
        email: '',
    };

    // Determine travel mode from deliveryMode
    const travelMode = order.deliveryMode?.toUpperCase() === 'AIR' ? 'Air' : 'Road';

    // Build final payload
    return {
        poNumber: order.awbNumber || order.referenceId || order.orderId || '',
        travelMode: travelMode,
        grossWeight: totalWeight,
        packetCount: totalPacketCount, // Number of boxes
        material: null,
        lbhData: lbhData,
        invoiceDetails: invoiceDetails, // Single master invoice
        consignor: consignor,
        consignee: consignee,
        docketNo: null,
        packetLbhUom: 'cm', // Changed to cm as per requirement
        totalConsignmentValue: orderAmount,
        ftlOrPtl: '0', // Changed to "0" (PTL) as per requirement
        openBoxPickup: 0, // Delivery type = 0
        truckType: null, // Changed to null as per requirement
    };
  }

  // Stub implementations for other required interface methods
  async createOrder<T, R>(orderDetails: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Use createOrderV2 for Ekart');
  }

  async getOrderDetails<T, R>(params: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async cancelOrder<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async updateOrderV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async pushOrderToDRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async pushOrdersToPRS<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async pushOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async manifestOrderToTracking<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async updateEcomOrderWebhook<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async createPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async cancelPickupV2<T, R>(data: T, partnerCode: string, eligiblePartners?: any): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async pushOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async updateOrderToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }

  async updatePartnerToHubOps<T, R>(data: T): Promise<R> {
    throw new CustomHttpException(HttpStatus.NOT_IMPLEMENTED, 'Method not implemented for Ekart');
  }
}

