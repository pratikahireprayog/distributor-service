import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AxiosResponse } from "axios";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { MoverAuthService } from "./mover-auth.service";
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from "src/common/dtos/base2.dto";
import {
  BaseOrderResDto,
  BaseResDto,
} from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { MOVER_ENV_KEYS, MOVER_DEFAULTS } from "./mover.enum";

@Injectable()
export class MoverService extends BaseNetworkPartner {
  protected readonly logger = new Logger(MoverService.name);

  constructor(
    private readonly authService: MoverAuthService,
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    // Note: endpointConfigRepository is still required by BaseNetworkPartner
    // but we use environment variables instead of database for configuration
    super(
      PARTNER_CODE_ENUM.MOVER,
      authService,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  /**
   * Create an order with Mover using V2 payload
   * Directly calls book-vehicle API
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      // Get auth headers
      const authHeaders = await this.authService.getAuthHeaders();
      
      // Get book-vehicle endpoint URL
      const endpointUrl = this.configService.get<string>(
        MOVER_ENV_KEYS.CREATE_ORDER_URL,
        MOVER_DEFAULTS.CREATE_ORDER_URL
      );

      if (!endpointUrl) {
        throw new CustomHttpException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          `${MOVER_ENV_KEYS.CREATE_ORDER_URL} environment variable is not configured`
        );
      }

      // Transform the payload for book-vehicle API
      const transformedData = this.transformMoverCreateOrderV2Payload(orderDetails);

      // Make API call to book-vehicle
      const { response, requestUrl, requestBody } =
        await this.callMoverCreateOrderAPI(
          endpointUrl,
          transformedData,
          authHeaders,
          orderDetails.orderId || ""
        );

      // Format and return response (include transformed payload)
      return this.formatCreateOrderResponse<R>(
        response,
        requestUrl,
        requestBody,
        transformedData
      );
    } catch (error) {
      // If this is a CustomHttpException, throw it with HTTP error
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // For other errors, wrap them in CustomHttpException
      this.logger.error(
        `[Mover createOrderV2] Error for OrderId: ${orderDetails.orderId || ""} - ${error.message}`,
        error.stack
      );

      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create order with Mover: ${error.message}`
      );
    }
  }

  /**
   * Transform V2 order request into Mover book-vehicle API format
   */
  private transformMoverCreateOrderV2Payload<T extends BaseOrderReqDtoV2>(
    orderDetails: T
  ): any {
    // Find pickup and delivery addresses
    const pickupAddress =
      orderDetails.addresses?.find((a: any) => a.type === "PICKUP") ||
      ({} as any);
    const deliveryAddress =
      orderDetails.addresses?.find((a: any) => a.type === "DELIVERY") ||
      ({} as any);

    // Parse coordinates - handle string or number
    const parseCoordinate = (value: any): number => {
      if (typeof value === "string") {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return value || 0;
    };

    // Get parent shipment for dimensions and weight
    const parentShipment = orderDetails.parentShipment || ({} as any);
    const dimensions = parentShipment.dimensions || {};

    // Calculate number of packages (parent + children)
    const noOfPackages =
      1 + (orderDetails.childShipments?.length || 0);

    // Calculate goods worth from payment breakdown or final amount
    const goodsWorth =
      parseFloat(
        String(
          orderDetails.payment?.breakdown?.subTotal ||
            orderDetails.payment?.finalAmount ||
            0
        )
      ) || 0;

    // Transform stops from child shipments or other addresses
    const stops: any[] = [];
    
    // Add RETURN address as a stop if it exists
    const returnAddress = orderDetails.addresses?.find(
      (a: any) => a.type === "RETURN"
    );
    if (returnAddress) {
      stops.push({
        lat: parseCoordinate(returnAddress.latitude),
        lon: parseCoordinate(returnAddress.longitude),
        address: `${returnAddress.street}, ${returnAddress.city}, ${returnAddress.state} ${returnAddress.zip}`,
        delivery_note: returnAddress.landmark || "",
        contact_mobile: returnAddress.phone || "",
        contact_name: returnAddress.name || "",
        udf1: "",
        delivery_code: "",
      });
    }

    // Build the transformed payload for book-vehicle API
    const transformedData = {
      type: "parcel",
      ship_mode: "on_demand",
      route_info: {
        distance: 0,
        duration: 0,
      },
      pickup_loc: {
        lat: parseCoordinate(pickupAddress.latitude),
        lon: parseCoordinate(pickupAddress.longitude),
        address: `${pickupAddress.street || ""}, ${pickupAddress.city || ""}, ${pickupAddress.state || ""} ${pickupAddress.zip || ""}`.trim(),
        delivery_note: pickupAddress.landmark || "",
        contact_mobile: pickupAddress.phone || "",
        contact_name: pickupAddress.name || "",
        udf1: "",
        delivery_code: "",
      },
      drop_loc: {
        lat: parseCoordinate(deliveryAddress.latitude),
        lon: parseCoordinate(deliveryAddress.longitude),
        address: `${deliveryAddress.street || ""}, ${deliveryAddress.city || ""}, ${deliveryAddress.state || ""} ${deliveryAddress.zip || ""}`.trim(),
        delivery_note: deliveryAddress.landmark || "",
        contact_mobile: deliveryAddress.phone || "",
        contact_name: deliveryAddress.name || "",
        udf1: "",
        delivery_code: "",
      },
      vehicle_id: this.configService.get<number>(
        MOVER_ENV_KEYS.VEHICLE_ID,
        MOVER_DEFAULTS.VEHICLE_ID
      ),
      goods_type_id: this.configService.get<number>(
        MOVER_ENV_KEYS.GOODS_TYPE_ID,
        MOVER_DEFAULTS.GOODS_TYPE_ID
      ),
      stops: stops,
      insure_goods: false,
      optimise_route: false,
      no_of_packages: noOfPackages,
      goods_worth: goodsWorth,
      estimate_id: orderDetails.orderId || "",
      delivery_charge_pay_mode: 0, // 0 = prepaid, can be configured based on payment type
    };

    this.logger.log(
      `[Mover createOrderV2] Transformed request payload: ${JSON.stringify(transformedData)}`
    );

    return transformedData;
  }

  /**
   * Make API call to Mover book-vehicle API
   */
  private async callMoverCreateOrderAPI(
    endpointUrl: string,
    payload: any,
    authHeaders: Record<string, string>,
    orderId: string
  ): Promise<{
    response: AxiosResponse<any>;
    requestUrl: string;
    requestBody: any;
  }> {
    // Log request
    this.logger.log(
      `[Mover createOrderV2] Request for OrderId: ${orderId} - Payload: ${JSON.stringify(payload)}`
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpointUrl, payload, {
          headers: authHeaders,
          timeout: 30000,
        })
      );

      this.logger.log(
        `[Mover createOrderV2] Response for OrderId: ${orderId} - ${JSON.stringify(response.data)}`
      );

      // Check if the response contains an API-level error despite HTTP success status
      const isResponseError =
        response.data?.success === false ||
        response.data?.error ||
        (response.data?.statusCode && response.data.statusCode >= 400);

      // If we have an API-level error, throw an exception
      if (isResponseError) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Mover API error: ${response.data?.message || response.data?.error || "Unknown error"}`
        );
      }

      return { response, requestUrl: endpointUrl, requestBody: payload };
    } catch (error) {
      // Log all errors
      const errorData = {
        message: error.message || "Unknown error",
        code: error.code || "",
        status: error.response?.status || "",
        responseData: error.response?.data || {},
        stack: error.stack,
      };

      this.logger.error(
        `[Mover createOrderV2] Error for OrderId: ${orderId} - ${JSON.stringify(errorData)}`,
        error.stack
      );

      // If it's already a CustomHttpException, rethrow it
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // For 400 errors, include the request payload in the error response
      if (error.response?.status === 400) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Mover book-vehicle API call failed: ${error.response?.data?.message || error.message}`,
          {
            requestPayload: payload,
            requestUrl: endpointUrl,
            responseData: error.response?.data || {},
          }
        );
      }

      // Otherwise, wrap it
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Mover API call failed: ${error.response?.data?.message || error.message}`,
        {
          requestPayload: payload,
          requestUrl: endpointUrl,
          responseData: error.response?.data || {},
        }
      );
    }
  }

  /**
   * Format Mover API response into standard format
   */
  private formatCreateOrderResponse<R extends BaseOrderResDto>(
    response: AxiosResponse<any>,
    requestUrl?: string,
    requestBody?: any,
    transformedPayload?: any
  ): R {
    const responseData = response.data;

    // Extract key fields from Mover response
    // Adjust these based on actual Mover API response structure
    const trackingId = responseData?.data?.tracking_id || 
                       responseData?.tracking_id || 
                       responseData?.order_id || 
                       "";
    const referenceNumber = responseData?.data?.order_id || 
                           responseData?.order_id || 
                           "";
    const labelUrl = responseData?.data?.label_url || 
                    responseData?.label_url || 
                    "";

    return {
      statusCode: response.status || 200,
      message: "Order created successfully with Mover",
      partnerCode: this.partnerCode,
      metadata: {},
      data: {
        originalResponse: responseData,
        trackingId: trackingId,
        referenceNumber: referenceNumber,
        labelUrl: labelUrl,
        requestUrl: requestUrl,
        requestBody: requestBody,
        transformedPayload: transformedPayload || requestBody, // Include transformed payload
      },
      trace: {
        timestamp: new Date().toISOString(),
        partnerCode: this.partnerCode,
      },
    } as unknown as R;
  }

  /**
   * Cancel an order with Mover using V2 payload
   */
  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      // Get auth headers
      const authHeaders = await this.authService.getAuthHeaders();
      
      // Get endpoint URL from environment variables
      const endpointUrl = this.configService.get<string>(
        MOVER_ENV_KEYS.CANCEL_ORDER_URL,
        MOVER_DEFAULTS.CANCEL_ORDER_URL
      );

      if (!endpointUrl) {
        throw new CustomHttpException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          `${MOVER_ENV_KEYS.CANCEL_ORDER_URL} environment variable is not configured`
        );
      }

      // Transform the payload for Mover API
      const transformedData = this.transformMoverCancelOrderV2Payload(data);

      // Make API call
      const { response, requestUrl, requestBody } =
        await this.callMoverCancelOrderAPI(
          endpointUrl,
          transformedData,
          authHeaders,
          data.orderId || data.cAwbNumbers?.[0] || ""
        );

      // Format and return response
      return this.formatCancelOrderResponse<R>(
        response,
        requestUrl,
        requestBody
      );
    } catch (error) {
      // If this is a CustomHttpException, throw it with HTTP error
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // For other errors, wrap them in CustomHttpException
      this.logger.error(
        `[Mover cancelOrderV2] Error for OrderId: ${data.orderId || data.cAwbNumbers?.[0] || ""} - ${error.message}`,
        error.stack
      );

      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to cancel order with Mover: ${error.message}`
      );
    }
  }

  /**
   * Transform V2 cancel order request into Mover API format
   */
  private transformMoverCancelOrderV2Payload<T extends BaseCancelOrderDtoV2>(
    data: T
  ): any {
    // Get orderId - prefer orderId from DTO, fallback to first cAwbNumber
    const orderId = data.orderId || data.cAwbNumbers?.[0] || "";

    if (!orderId) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        "OrderId or cAwbNumber is required for cancellation"
      );
    }

    if (!data.cancelReason) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        "CancelReason is required for cancellation"
      );
    }

    // Build the transformed payload with capitalized field names as per Mover API
    const transformedData = {
      OrderId: orderId,
      CancelReason: data.cancelReason,
    };

    this.logger.log(
      `[Mover cancelOrderV2] Transformed request payload: ${JSON.stringify(transformedData)}`
    );

    return transformedData;
  }

  /**
   * Make API call to Mover cancel order API
   */
  private async callMoverCancelOrderAPI(
    endpointUrl: string,
    payload: any,
    authHeaders: Record<string, string>,
    orderId: string
  ): Promise<{
    response: AxiosResponse<any>;
    requestUrl: string;
    requestBody: any;
  }> {
    // Log request
    this.logger.log(
      `[Mover cancelOrderV2] Request for OrderId: ${orderId} - Payload: ${JSON.stringify(payload)}`
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpointUrl, payload, {
          headers: authHeaders,
          timeout: 30000,
        })
      );

      this.logger.log(
        `[Mover cancelOrderV2] Response for OrderId: ${orderId} - ${JSON.stringify(response.data)}`
      );

      // Check if the response contains an API-level error despite HTTP success status
      const isResponseError =
        response.data?.success === false ||
        response.data?.error ||
        (response.data?.statusCode && response.data.statusCode >= 400);

      // If we have an API-level error, throw an exception
      if (isResponseError) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Mover API error: ${response.data?.message || response.data?.error || "Unknown error"}`
        );
      }

      return { response, requestUrl: endpointUrl, requestBody: payload };
    } catch (error) {
      // Log all errors
      const errorData = {
        message: error.message || "Unknown error",
        code: error.code || "",
        status: error.response?.status || "",
        responseData: error.response?.data || {},
        stack: error.stack,
      };

      this.logger.error(
        `[Mover cancelOrderV2] Error for OrderId: ${orderId} - ${JSON.stringify(errorData)}`,
        error.stack
      );

      // If it's already a CustomHttpException, rethrow it
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // Otherwise, wrap it
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Mover API call failed: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Format Mover cancel order API response into standard format
   */
  private formatCancelOrderResponse<R extends BaseResDto>(
    response: AxiosResponse<any>,
    requestUrl?: string,
    requestBody?: any
  ): R {
    const responseData = response.data;

    return {
      statusCode: response.status || 200,
      message: "Order cancelled successfully with Mover",
      partnerCode: this.partnerCode,
      metadata: {},
      data: {
        originalResponse: responseData,
        status: "CANCELLED",
        requestUrl: requestUrl,
        requestBody: requestBody,
      },
      trace: {
        timestamp: new Date().toISOString(),
        partnerCode: this.partnerCode,
      },
    } as unknown as R;
  }
}

