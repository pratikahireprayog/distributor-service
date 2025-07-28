import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";
import { v4 as uuidv4 } from "uuid";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { PorterAuthService } from "./porter.auth-service";

import {
  BaseOrderResDto,
} from "src/common/dtos/base.dto";
import { BaseOrderReqDtoV2, extractLineItems } from "src/common/dtos/base2.dto";

import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { AxiosResponse } from "axios";

@Injectable()
export class PorterService extends BaseNetworkPartner {
  protected readonly logger = new Logger(PorterService.name);
  private readonly httpsAgent: https.Agent;

  constructor(
    protected readonly authProvider: PorterAuthService,
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.PORTER,
      authProvider,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );

    // Configure HTTPS agent with proper keep-alive and timeouts
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      timeout: 60000,
    });
  }

  /**
   * Create an order with Porter
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      // 1. Transform the payload for Porter API
      const transformedData = this.transformPorterPayload(orderDetails);

      // 2. Get endpoint configuration
      const endpoint = {
          url: this.configService.get<string>('PORTER_CREATE_ORDER_URL')
      }

      if (!endpoint.url) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'PORTER_CREATE_ORDER_URL environment variable is not configured'
        );
      }

      // 3. Make API call
      const response = await this.callPorterCreateOrderAPI(
        endpoint,
        transformedData,
      );

      // 4. Format and return response
      return this.formatCreateOrderResponse<R>(response);
    } catch (error) {
      this.logger.error(`Porter createOrder error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  /**
   * Transform order request into Porter API format
   */
  private transformPorterPayload<T extends BaseOrderReqDtoV2>(orderDetails: T): any {
    console.log("porter payload", orderDetails);
    
    // Find pickup and delivery addresses
    const pickupAddress: any = orderDetails.addresses?.find((a: any) => a.type === 'PICKUP') || {};
    const deliveryAddress: any = orderDetails.addresses?.find((a: any) => a.type === 'DELIVERY') || {};

    // Generate request_id
    const requestId = uuidv4().replace(/-/g, '');

    // Build Porter API payload
    const transformedData = {
      request_id: requestId,
      delivery_instructions: {
        instructions_list: [
          {
            type: "text",
            description: orderDetails.parentShipment?.note || "Handle with care"
          }
        ]
      },
      pickup_details: {
        address: {
          apartment_address: pickupAddress.addressName || "",
          street_address1: pickupAddress.street || "",
          street_address2: pickupAddress.landmark || "",
          landmark: pickupAddress.landmark || "",
          city: pickupAddress.city || "",
          state: pickupAddress.state || "",
          pincode: pickupAddress.zip || "",
          country: pickupAddress.country || "India",
          lat: parseFloat(pickupAddress.latitude) || 0,
          lng: parseFloat(pickupAddress.longitude) || 0,
          contact_details: {
            name: pickupAddress.name || "",
            phone_number: pickupAddress.phone || ""
          }
        }
      },
      drop_details: {
        address: {
          apartment_address: deliveryAddress.addressName || "",
          street_address1: deliveryAddress.street || "",
          street_address2: deliveryAddress.landmark || "",
          landmark: deliveryAddress.landmark || "",
          city: deliveryAddress.city || "",
          state: deliveryAddress.state || "",
          pincode: deliveryAddress.zip || "",
          country: deliveryAddress.country || "India",
          lat: parseFloat(deliveryAddress.latitude) || 0,
          lng: parseFloat(deliveryAddress.longitude) || 0,
          contact_details: {
            name: deliveryAddress.name || "",
            phone_number: deliveryAddress.phone || ""
          }
        }
      }
    };

    this.logger.log(
      `[Porter createOrder] Transformed request payload: ${JSON.stringify(transformedData)}`
    );

    return transformedData;
  }

  /**
   * Make API call to Porter order API
   */
  private async callPorterCreateOrderAPI(
    endpoint: any,
    payload: any,
  ): Promise<AxiosResponse<any>> {
    console.log("porter transformed payload", JSON.stringify(payload));

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
      console.log("porter error", JSON.stringify(error.resposne));
      throw error;
    }
  }

  /**
   * Format Porter create order response
   */
  private formatCreateOrderResponse<R extends BaseOrderResDto>(
    response: AxiosResponse<any>
  ): R {
    const responseData = response.data;

    // Check if the response contains an error
    if (responseData.error) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Porter API Error: ${responseData.error.message || 'Unknown error'}`
      );
    }

    // Extract tracking information from Porter response
    const orderId = responseData.order_id;
    const trackingUrl = responseData.tracking_url;

    return {
      statusCode: 200,
      message: "Order created successfully with Porter",
      partnerCode: this.partnerCode,
      data: {
        trackingId: orderId,
        referenceNumber: orderId,
        labelUrl: trackingUrl,
        rawResponse: responseData
      }
    } as R;
  }
}
