import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { BaseNetworkPartner } from '../../base/base-network-partner.abstract';
import { UniuniAuthService } from './uniuni-auth.service';
import { EndpointConfigRepository } from 'src/common/repositories/endpoint-configs/endpoint-configs.repository';
import { SchemaMapperService } from 'src/infrastructure/schema-mapper';
import { INetworkPartner } from '../../interfaces/network-partner.interface';
import { BaseOrderReqDto, BaseOrderResDto, BaseResDto } from 'src/common/dtos/base.dto';
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2, BaseUpdateOrderDtoV2 } from 'src/common/dtos/base2.dto';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';

@Injectable()
export class UniuniService extends BaseNetworkPartner implements INetworkPartner {
  protected readonly logger = new Logger(UniuniService.name);
  private readonly endpointConfigs = {
    CREATE_ORDER: {
      url: 'https://sjqa.uniexpress.org/orders/createbusinessorder',
      method: 'POST',
      requiresAuth: true,
    },
  };

  constructor(
    private readonly uniuniAuthService: UniuniAuthService,
    httpService: HttpService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>,
    private readonly configService: ConfigService,
  ) {
    super(
      PARTNER_CODE_ENUM.UNIUNI,
      uniuniAuthService,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  async createOrder<T extends any, R extends BaseOrderResDto>(
    orderDetails: T,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      this.logger.debug(`UNIUNI createOrder called with order: ${(orderDetails as any).orderId}`);
      
      const transformedData = await this.transformCreateUniuniPayload(orderDetails);
      const response = await this.callUniuniCreateOrderAPI(transformedData);
      
      return this.formatCreateOrderResponse(response) as R;
    } catch (error) {
      this.logger.error(`UNIUNI createOrder failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `UNIUNI createOrder failed: ${error.message}`
      );
    }
  }

  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    eligiblePartners?: any
  ): Promise<R> {
    return this.createOrder<T, R>(orderDetails, eligiblePartners);
  }

  async cancelOrder<T extends any, R extends BaseResDto>(data: T): Promise<R> {
    throw new Error('UNIUNI cancelOrder not implemented');
  }

  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    return this.cancelOrder<T, R>(data);
  }

  async updateOrderV2<T extends BaseUpdateOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      this.logger.debug(`UNIUNI updateOrderV2 called with order: ${data.orderId}`);
      
      // For now, throw an error as UNIUNI update order is not implemented
      throw new Error('UNIUNI updateOrderV2 not implemented');
    } catch (error) {
      this.logger.error(`UNIUNI updateOrderV2 failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `UNIUNI updateOrderV2 failed: ${error.message}`
      );
    }
  }

  async createManifest<T extends any, R extends BaseResDto>(manifestationDetails: T): Promise<R> {
    throw new Error('UNIUNI createManifest not implemented');
  }

  private async transformCreateUniuniPayload(orderDetails: any): Promise<any> {
    try {
      this.logger.debug(`Transforming payload for UNIUNI order: ${orderDetails.orderId}`);
      const pickupAddress = orderDetails.addresses.find(addr => addr.type === 'PICKUP');
      const deliveryAddress = orderDetails.addresses.find(addr => addr.type === 'DELIVERY');

      if (!pickupAddress || !deliveryAddress) {
        throw new Error('Both pickup and delivery addresses are required');
      }

      const transformedData = {
        customer_no: 2821,
        reference: orderDetails.referenceId || orderDetails.orderId,
        trace_no: orderDetails.orderId,
        pickup_address: `${pickupAddress.street}, ${pickupAddress.city}`,
        delivery_address: `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.state}, ${deliveryAddress.country}`,
        postal_code: deliveryAddress.zip,
        receiver: deliveryAddress.name,
        delivery_unit_no: deliveryAddress.landmark || '',
        receiver_phone: deliveryAddress.phone,
        receiver_email: deliveryAddress.email,
        length: orderDetails.parentShipment?.dimensions?.length || 0,
        width: orderDetails.parentShipment?.dimensions?.width || 0,
        height: orderDetails.parentShipment?.dimensions?.height || 0,
        weight: orderDetails.parentShipment?.physicalWeight || 0,
        weight_uom: 'LBS',
        dimension_uom: 'IN',
        buzz_code: orderDetails.referenceId || orderDetails.orderId,
        require_signature: false,
        start_postal_code: pickupAddress.zip,
        pickup_warehouse: ''
      };
      
      this.logger.debug(`Transformed payload for UNIUNI: ${JSON.stringify(transformedData)}`);
      return transformedData;
    } catch (error) {
      this.logger.error(`Error transforming payload for UNIUNI: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Failed to transform payload for UNIUNI: ${error.message}`
      );
    }
  }

  private async callUniuniCreateOrderAPI(transformedData: any): Promise<any> {
    try {
      this.logger.debug('Calling UNIUNI create order API');
      
      const authHeaders = await this.uniuniAuthService.getAuthHeaders();
      const url = this.endpointConfigs.CREATE_ORDER.url;
      
      const response = await firstValueFrom(
        this.httpService.post(url, transformedData, { headers: authHeaders })
      );

      this.logger.debug(`UNIUNI API response status: ${response.status}`);
      this.logger.debug(`UNIUNI API response data: ${JSON.stringify(response.data)}`);
      
      return response.data;
    } catch (error) {
      this.logger.error(`UNIUNI API call failed: ${error.message}`);
      throw new Error(`UNIUNI API call failed: ${error.message}`);
    }
  }

  private formatCreateOrderResponse(responseData: any): BaseOrderResDto {
    try {
      this.logger.debug('Formatting UNIUNI create order response');
      
      // Check for success indicators
      const isSuccess = 
        responseData.status === 'SUCCESS' ||
        responseData.success === true ||
        responseData.statusCode === 200 ||
        responseData.statusCode === 201;

      if (isSuccess) {
        return {
          statusCode: 200,
          message: 'Order created successfully with UNIUNI',
          partnerCode: PARTNER_CODE_ENUM.UNIUNI,
          metadata: {
            transporterId: responseData.data?.transporter_id || responseData.transporter_id || 'UNIUNI_TRANSPORTER'
          },
          data: {
            originalResponse: responseData,
            trackingId: responseData.data?.tracking_number || responseData.tracking_number || responseData.data?.order_id || responseData.order_id || 'UNKNOWN',
            referenceNumber: responseData.data?.reference || responseData.reference || 'UNKNOWN',
            labelUrl: responseData.data?.label_url || responseData.label_url || '',
            requestUrl: this.endpointConfigs.CREATE_ORDER.url,
            requestBody: responseData.data?.request_body || responseData.request_body || {},
            shipmentDetails: [
              {
                awbNumber: responseData.data?.order_id || responseData.order_id || 'UNKNOWN',
                partnerAwbNumber: responseData.data?.tracking_number || responseData.tracking_number || 'UNKNOWN',
                partnerName: 'UNIUNI',
                transporterId: responseData.data?.transporter_id || responseData.transporter_id || 'UNIUNI_TRANSPORTER'
              }
            ]
          }
        };
      } else {
        // Handle error response
        const errorMessage = responseData.message || responseData.error || responseData.ret_msg || 'Unknown error';
        return {
          statusCode: responseData.statusCode || 500,
          message: `UNIUNI order creation failed: ${errorMessage}`,
          partnerCode: PARTNER_CODE_ENUM.UNIUNI,
          metadata: {
            transporterId: 'UNIUNI_TRANSPORTER'
          },
          data: {
            originalResponse: responseData,
            trackingId: 'UNKNOWN',
            referenceNumber: 'UNKNOWN',
            labelUrl: '',
            requestUrl: this.endpointConfigs.CREATE_ORDER.url,
            requestBody: {},
            shipmentDetails: []
          }
        };
      }
    } catch (error) {
      this.logger.error(`Failed to format UNIUNI response: ${error.message}`);
      return {
        statusCode: 500,
        message: `Failed to format UNIUNI response: ${error.message}`,
        partnerCode: PARTNER_CODE_ENUM.UNIUNI,
        metadata: {
          transporterId: 'UNIUNI_TRANSPORTER'
        },
        data: {
          originalResponse: null,
          trackingId: 'UNKNOWN',
          referenceNumber: 'UNKNOWN',
          labelUrl: '',
          requestUrl: this.endpointConfigs.CREATE_ORDER.url,
          requestBody: {},
          shipmentDetails: []
        }
      };
    }
  }
}
