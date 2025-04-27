import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { ShipyaariAuthService } from "./shipyaari-auth.service";
import { SHIPYAARI_ENV_VARS } from "./shipyaari.enum";
import { ShipyaariErrorHelper } from "./shipyaari-error.helper";

import {
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
  BaseCancelOrderDto,
  DRSPayloadDTO,
} from "src/common/dtos/base.dto";

import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { AxiosResponse } from "axios";
import { EndpointConfigModel } from "src/common/repositories/endpoint-configs/endpoint-configs.schema";

@Injectable()
export class ShipyaariService extends BaseNetworkPartner {
  protected readonly logger = new Logger(ShipyaariService.name);
  private readonly errorHelper: ShipyaariErrorHelper;

  constructor(
    private readonly authService: ShipyaariAuthService,
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.SHIPYAARI,
      authService,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );

    // Initialize the error helper
    this.errorHelper = new ShipyaariErrorHelper(PARTNER_CODE_ENUM.SHIPYAARI);
  }

  /**
   * Create an order with Shipyaari
   * Direct implementation without using superclass
   */
  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      // Get auth token and endpoint
      const authHeaders = await this.authService.getAuthHeaders();
      const endpoint = await this.fetchEndpointConfig("CREATE_ORDER");

      // Transform the payload
      const transformedData = this.transformShipyaariCreateOrderPayload(orderDetails);

      // Make API call
      const response = await this.callShipyaariCreateOrderAPI(
        endpoint,
        transformedData,
        authHeaders,
        orderDetails.awbNumber || ""
      );

      // Format and return response
      return this.formatCreateOrderResponse<R>(response, orderDetails.awbNumber);
    } catch (error) {
      // If this is a CustomHttpException, throw it with HTTP error
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // For other errors, use the error helper to handle them properly
      return this.errorHelper.handleHttpError(
        error,
        orderDetails.awbNumber || "",
        "CREATE_ORDER"
      );
    }
  }

  /**
   * Get endpoint configuration for Shipyaari API
   */
  private async fetchEndpointConfig(
    endpointId: string
  ): Promise<EndpointConfigModel> {
    const endpoint = await this.endpointConfigRepository.getOne({
      partnerCode: this.partnerCode,
      endpointId: endpointId,
    });

    if (!endpoint) {
      throw new CustomHttpException(
        HttpStatus.NOT_FOUND,
        `Endpoint configuration not found for ${this.partnerCode} - ${endpointId}`
      );
    }

    return endpoint;
  }

  /**
   * Transform order request into Shipyaari API format
   */
  private transformShipyaariCreateOrderPayload<T extends BaseOrderReqDto>(
    orderDetails: T
  ): any {
    const transformedData = {
      pickupDetails: {
        fullAddress: `${orderDetails.pickupAddress?.address1 || ""} ${orderDetails.pickupAddress?.address2 ? orderDetails.pickupAddress?.address2 + ", " : ""}${orderDetails.pickupAddress?.city || ""}, ${orderDetails.pickupAddress?.state || ""} ${orderDetails.pickupAddress?.zip || ""}`,
        pincode: parseInt(orderDetails.pickupAddress?.zip || "0"),
        contact: {
          name: orderDetails.pickupAddress?.name || "",
          mobileNo: parseInt(orderDetails.pickupAddress?.mobile || "0"),
        },
      },
      deliveryDetails: {
        fullAddress: `${orderDetails.shippingAddress?.address1 || ""} ${orderDetails.shippingAddress?.address2 ? orderDetails.shippingAddress?.address2 + ", " : ""}${orderDetails.shippingAddress?.city || ""}, ${orderDetails.shippingAddress?.state || ""} ${orderDetails.shippingAddress?.zip || ""}`,
        pincode: parseInt(orderDetails.shippingAddress?.zip || "0"),
        contact: {
          name: orderDetails.shippingAddress?.name || "",
          mobileNo: parseInt(orderDetails.shippingAddress?.mobile || "0"),
        },
        gstNumber: (orderDetails.shippingAddress as any)?.gstNumber || "",
      },
      boxInfo: [
        {
          name: "box_1",
          weightUnit: "Kg",
          deadWeight:
            parseFloat((orderDetails as any).dimensions?.weight || "0") / 1000, // Convert to kg
          length: parseFloat((orderDetails as any).dimensions?.length || "0"),
          breadth: parseFloat((orderDetails as any).dimensions?.breadth || "0"),
          height: parseFloat((orderDetails as any).dimensions?.height || "0"),
          measureUnit: "cm",
          products: [
            {
              name: (orderDetails as any).productDetails?.name || "PRODUCT",
              category: (orderDetails as any).productDetails?.category || "",
              sku: (orderDetails as any).productDetails?.sku || "",
              qty: (orderDetails as any).productDetails?.quantity || 1,
              unitPrice: (orderDetails as any).productDetails?.price || 0,
              unitTax: (orderDetails as any).productDetails?.tax || 0,
              weightUnit: "kg",
              deadWeight:
                parseFloat((orderDetails as any).dimensions?.weight || "0") /
                1000,
              length: parseFloat(
                (orderDetails as any).dimensions?.length || "0"
              ),
              breadth: parseFloat(
                (orderDetails as any).dimensions?.breadth || "0"
              ),
              height: parseFloat(
                (orderDetails as any).dimensions?.height || "0"
              ),
              measureUnit: "cm",
            },
          ],
          codInfo: {
            isCod: (orderDetails as any).paymentDetails?.isCOD || false,
            collectableAmount: (orderDetails as any).paymentDetails?.isCOD
              ? parseFloat((orderDetails as any).paymentDetails?.amount || "0")
              : 0,
            invoiceValue: parseFloat(
              (orderDetails as any).paymentDetails?.amount || "0"
            ),
          },
          podInfo: {
            isPod: false,
          },
          insurance: false,
        },
      ],
      orderType: (orderDetails as any).orderType || "B2C",
      transit: (orderDetails as any).shippingType || "FORWARD",
      courierPartner: "",
      source: "",
      pickupDate: "",
      gstNumber: "",
      orderId: (orderDetails as any).awbNumber || "",
      eWayBillNo:
        (orderDetails as any).ewayBillNos &&
        (orderDetails as any).ewayBillNos.length > 0
          ? (orderDetails as any).ewayBillNos[0]
          : "",
      brandName: "",
      brandLogo: "",
    };

    this.logger.log(
      `[Shipyaari createOrder] Transformed request payload: ${JSON.stringify(transformedData)}`
    );

    return transformedData;
  }

  /**
   * Make API call to Shipyaari order API
   */
  private async callShipyaariCreateOrderAPI(
    endpoint: EndpointConfigModel,
    payload: any,
    authHeaders: Record<string, string>,
    awbNumber: string
  ): Promise<AxiosResponse<any>> {
    // Log request
    this.logger.log(
      `[Shipyaari createOrder] Request for AWB: ${awbNumber} - Payload: ${JSON.stringify(payload)}`
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint.url, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeaders["Authorization"],
          },
        })
      );

      this.logger.log(
        `[Shipyaari createOrder] Response for AWB: ${awbNumber} - ${JSON.stringify(response.data)}`
      );

      // Check if the response contains an API-level error despite HTTP success status
      const apiStatusCode = response.data?.statusCode;
      const isResponseError =
        response.data?.success === false ||
        apiStatusCode >= 400 ||
        (response.data?.message && response.data?.message.includes("Required"));

      // If we have an API-level error, throw an exception with the API status code
      if (isResponseError) {
        this.errorHelper.handleApiError(
          response.data,
          awbNumber,
          "CREATE_ORDER"
        );
      }

      return response;
    } catch (error) {
      this.errorHelper.handleHttpError(error, awbNumber, "CREATE_ORDER");
    }
  }

  /**
   * Format Shipyaari API response into standard format
   */
  private formatCreateOrderResponse<R extends BaseOrderResDto>(
    response: AxiosResponse<any>,
    awbNumber?: string
  ): R {
    const result = new BaseOrderResDto() as R;

    // Process successful response
    const orderId = response.data?.data?.[0]?.orderId || awbNumber || "";
    let apiMessage = response.data.message || "Order created successfully";
    let responseAwbNumber = "";
    let orderStatus = "";

    // Extract awb number and status from the nested response
    if (response.data?.data?.[0]?.awbs?.[0]?.tracking) {
      const trackingInfo = response.data.data[0].awbs[0].tracking;
      responseAwbNumber = trackingInfo.awb || "";

      // Get the current status from the first status entry
      if (trackingInfo.status && trackingInfo.status.length > 0) {
        orderStatus = trackingInfo.status[0].currentStatus || "";
      }
    }

    // Use API status code for successful responses too
    result.statusCode = response.data?.statusCode || 200;
    // Set generic success message at root level
    result.message = "Shipyaari Create Order API success";
    // Add partner code at root level
    result.partnerCode = this.partnerCode;

    // Create a simplified data structure with only essential fields
    result.data = {
      success: true,
      orderId: orderId,
      awbNumber: responseAwbNumber || awbNumber || "",
      status: orderStatus,
      message: apiMessage, // Add the API message here
    };

    result.trace = {
      timestamp: new Date().toISOString(),
      partnerCode: this.partnerCode,
      operation: "CREATE_ORDER",
    };

    return result;
  }

  /**
   * Create a manifest with Shipyaari
   * Delegates to BaseNetworkPartner for endpoint handling
   */
  async createManifest<T extends BaseReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    try {
      return await super.createManifest<T, R>(manifestationDetails);
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error;
      }
      this.errorHelper.handleHttpError(
        error,
        (manifestationDetails as any).awbNumber || "",
        "CREATE_MANIFEST"
      );
    }
  }

  /**
   * Get order details from Shipyaari
   * Delegates to BaseNetworkPartner for endpoint handling
   */
  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    try {
      return await super.getOrderDetails<T, R>(params);
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error;
      }
      this.errorHelper.handleHttpError(
        error,
        (params as any).awbNumber || "",
        "GET_ORDER_DETAILS"
      );
    }
  }

  /**
   * Cancel an order with Shipyaari
   * Delegates to BaseNetworkPartner for endpoint handling
   */
  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    try {
      return await super.cancelOrder<T, R>(data);
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error;
      }
      this.errorHelper.handleHttpError(
        error,
        data.awbNumber || "",
        "CANCEL_ORDER"
      );
    }
  }

  /**
   * Override validation method if needed for Shipyaari-specific validation
   */
  protected validateInputForOperation(operation: string, data: any): boolean {
    // Add Shipyaari-specific validation if needed
    return super.validateInputForOperation(operation, data);
  }
}
