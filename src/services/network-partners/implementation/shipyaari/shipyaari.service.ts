import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { ShipyaariAuthService } from "./shipyaari-auth.service";
import { SHIPYAARI_ENV_VARS } from "./shipyaari.enum";
import { ShipyaariErrorHelper } from "./shipyaari-error.helper";
import { BaseOrderReqDtoV2,extractLineItems } from "src/common/dtos/base2.dto";
import {
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
  BaseCancelOrderDto,
  DRSPayloadDTO,
  ManifestReqDto,
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
  private readonly httpsAgent: https.Agent;

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

    // Configure HTTPS agent with proper keep-alive and timeouts
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      timeout: 60000,
    });

    // Remove axios-retry configuration as Temporal handles retries
  }

  /**
   * Create an order with Shipyaari
   * Direct implementation without using superclass
   */
  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      // Get auth token and endpoint
      const authHeaders = await this.authService.getAuthHeaders();
      const endpoint = await this.fetchEndpointConfig("CREATE_ORDER");

      // Transform the payload
      const transformedData =
        this.transformShipyaariCreateOrderPayload(orderDetails);

      // Make API call
      const { response, requestUrl, requestBody } = await this.callShipyaariCreateOrderAPI(
        endpoint,
        transformedData,
        authHeaders,
        orderDetails.awbNumber || ""
      );

      // Format and return response
      return this.formatCreateOrderResponse<R>(response, requestUrl, requestBody);
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
    // TODO: Replace pickupAddress with fmHubAddress
    const transformedData = {
      pickupDetails: {
        fullAddress: `${orderDetails.fmHubAddress?.address1 || ""} ${orderDetails.fmHubAddress?.address2 ? orderDetails.fmHubAddress?.address2 + ", " : ""}${orderDetails.fmHubAddress?.city || ""}, ${orderDetails.fmHubAddress?.state || ""} ${orderDetails.fmHubAddress?.zip || ""}`,
        pincode: parseInt(orderDetails.fmHubAddress?.zip || "0"),
        contact: {
          name: orderDetails.fmHubAddress?.name || "",
          mobileNo: parseInt(orderDetails.fmHubAddress?.mobile || "0"),
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
            parseFloat((orderDetails as any).dimensions?.weight || "1") / 1000, // Convert to kg
          length: parseFloat((orderDetails as any).dimensions?.length || "1"),
          breadth: parseFloat((orderDetails as any).dimensions?.breadth || "0"),
          height: parseFloat((orderDetails as any).dimensions?.height || "0"),
          measureUnit: "cm",
          products: [
            {
              name: (orderDetails as any).productDetails?.name || "Product",
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
      orderType:  "B2C",
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
  ): Promise<{ response: AxiosResponse<any>; requestUrl: string; requestBody: any }> {
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
          // Use HTTPS agent for secure connections
          httpsAgent: this.httpsAgent,
          // Set timeout to avoid long-running requests
          timeout: 30000,
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

      return { response, requestUrl: endpoint.url, requestBody: payload };
    } catch (error) {
      // Log all errors, not just network-related ones
      const errorData = {
        message: error.message || "Unknown error",
        code: error.code || "",
        status: error.response?.status || "",
        responseData: error.response?.data || {},
        stack: error.stack,
      };

      this.logger.error(
        `[Shipyaari createOrder] Error for AWB: ${awbNumber} - ${JSON.stringify(errorData)}`,
        error.stack
      );

      this.errorHelper.handleHttpError(error, awbNumber, "CREATE_ORDER");
    }
  }

  /**
   * Format Shipyaari API response into standard format
   */
  private formatCreateOrderResponse<R extends BaseOrderResDto>(
    response: AxiosResponse<any>,
    requestUrl?: string,
    requestBody?: any
  ): R {
    const responseData = response.data;

    // Extract key fields from Shipyaari response
    const orderData = responseData?.data?.[0] || {};
    const awbData = orderData?.awbs?.[0] || {};
    const trackingInfo = awbData?.tracking || {};
    const primaryAwbNumber = trackingInfo?.awb || "";
    const referenceNumber = orderData?.orderId?.toString?.() || "";
    const labelUrl = awbData?.labelUrl || awbData?.documents?.[0]?.url || "";

    return {
      statusCode: responseData?.statusCode || 200,
      message: "Order created successfully with Shipyaari",
      partnerCode: this.partnerCode,
      metadata: {
        transporterId: "06AAPCS9575E1ZR",
      },
      data: {
        originalResponse: responseData,
        trackingId: primaryAwbNumber,
        referenceNumber: referenceNumber,
        labelUrl: labelUrl,
        requestUrl: requestUrl,
        requestBody: requestBody,
      },
      trace: {
        timestamp: new Date().toISOString(),
        partnerCode: this.partnerCode,
      },
    } as unknown as R;
  }

  /**
   * Create a manifest with Shipyaari
   * Direct implementation without using superclass
   */
  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    throw new CustomHttpException(
      HttpStatus.NOT_IMPLEMENTED,
      "Create manifest functionality is not implemented for Shipyaari"
    );
    try {
      // Ensure we have awbNumbers populated
      if (
        !manifestationDetails.awbNumbers ||
        manifestationDetails.awbNumbers.length === 0
      ) {
        // Use awbNumber from BaseReqDto as fallback if awbNumbers is not set
        const baseData = manifestationDetails as unknown as BaseReqDto;
        manifestationDetails.awbNumbers = [baseData.awbNumber];
      }

      // Get auth token and endpoint
      const authHeaders = await this.authService.getAuthHeaders();
      const endpoint = await this.fetchEndpointConfig("CREATE_MANIFEST");

      // Transform the payload
      const transformedData =
        this.transformShipyaariCreateManifestPayload(manifestationDetails);

      // Get AWB numbers for reference - join array for logging
      const referenceAwb = manifestationDetails.awbNumbers.join(",");

      // Make API call
      const response = await this.callShipyaariCreateManifestAPI(
        endpoint,
        transformedData,
        authHeaders,
        referenceAwb
      );

      // Format and return response
      return this.formatCreateManifestResponse<R>(response, referenceAwb);
    } catch (error) {
      // If this is a CustomHttpException, just rethrow it
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // Get AWB numbers for reference - join array for logging
      const referenceAwb = manifestationDetails.awbNumbers.join(",");

      // Let the error helper handle other types of errors (like raw HTTP errors)
      // It will wrap them in a CustomHttpException
      throw this.errorHelper.handleHttpError(
        error,
        referenceAwb,
        "CREATE_MANIFEST"
      );
    }
  }

  /**
   * Transform manifest request into Shipyaari API format
   */
  private transformShipyaariCreateManifestPayload(
    manifestDetails: ManifestReqDto
  ): any {
    // Use the array of AWB numbers from the request
    const transformedData = {
      awbs: manifestDetails.awbNumbers,
      source: "API",
    };

    this.logger.log(
      `[Shipyaari createManifest] Transformed request payload: ${JSON.stringify(transformedData)}`
    );

    return transformedData;
  }

  /**
   * Make API call to Shipyaari manifest API
   */
  private async callShipyaariCreateManifestAPI(
    endpoint: EndpointConfigModel,
    payload: any,
    authHeaders: Record<string, string>,
    awbNumber: string
  ): Promise<AxiosResponse<any>> {
    // Log request
    this.logger.log(
      `[Shipyaari createManifest] Request for AWB: ${awbNumber} - Payload: ${JSON.stringify(payload)}`
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint.url, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeaders["Authorization"],
          },
          // Use HTTPS agent for secure connections
          httpsAgent: this.httpsAgent,
          // Set timeout to avoid long-running requests
          timeout: 30000,
        })
      );

      this.logger.log(
        `[Shipyaari createManifest] Response for AWB: ${awbNumber} - ${JSON.stringify(response.data)}`
      );

      // Check if the response contains an API-level error despite HTTP success status
      const apiStatusCode = response.data?.statusCode;
      const isResponseError =
        response.data?.success === false ||
        apiStatusCode >= 400 ||
        (response.data?.message &&
          (response.data?.message.includes("Required") ||
            response.data?.message.includes("No data found") ||
            response.data?.message.includes("Error")));

      // If we have an API-level error, throw an exception with the API status code
      if (isResponseError) {
        throw this.errorHelper.handleApiError(
          response.data,
          awbNumber,
          "CREATE_MANIFEST"
        );
      }

      return response;
    } catch (error) {
      // Log all errors, not just network-related ones
      const errorData = {
        message: error.message || "Unknown error",
        code: error.code || "",
        status: error.response?.status || "",
        responseData: error.response?.data || {},
        stack: error.stack,
      };

      this.logger.error(
        `[Shipyaari createManifest] Error for AWB: ${awbNumber} - ${JSON.stringify(errorData)}`,
        error.stack
      );

      // Let the calling method handle the error
      throw error;
    }
  }

  /**
   * Format Shipyaari API response into standard format
   */
  private formatCreateManifestResponse<R extends BaseResDto>(
    response: AxiosResponse<any>,
    awbNumber?: string
  ): R {
    const result = new BaseResDto() as R;

    // Process response
    const manifestId = response.data?.data?.manifestId || "";
    const manifestUrl = response.data?.data?.manifestUrl || "";
    const apiMessage = response.data.message || "Manifest created successfully";

    // Convert comma-separated awbNumber string to array
    const awbNumbers = awbNumber ? awbNumber.split(",") : [];

    // Set standard response fields
    result.statusCode = response.data?.statusCode || 200;
    result.message = "Shipyaari Create Manifest API success";
    result.partnerCode = this.partnerCode;

    // Create standardized data structure
    result.data = {
      success: true,
      manifestId: manifestId,
      manifestUrl: manifestUrl,
      awbNumbers: awbNumbers,
      message: apiMessage,
      // Include original API response for reference
      apiResponse: response.data,
    };

    // Add minimal trace information
    result.trace = {
      timestamp: new Date().toISOString(),
      operation: "CREATE_MANIFEST",
    };

    return result;
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
   * Direct implementation without using superclass
   */
  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    try {
      // Get auth token and endpoint
      const authHeaders = await this.authService.getAuthHeaders();
      const endpoint = await this.fetchEndpointConfig("CANCEL_ORDER");

      // Transform the payload to use cAwbNumbers
      const transformedData = this.transformShipyaariCancelOrderPayload(data);

      // Make API call with all AWB numbers for proper logging
      const response = await this.callShipyaariCancelOrderAPI(
        endpoint,
        transformedData,
        authHeaders,
        data.cAwbNumbers // Pass the entire array of AWB numbers
      );

      // Format and return response
      return this.formatCancelOrderResponse<R>(response, data);
    } catch (error) {
      // If this is a CustomHttpException, throw it with HTTP error
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // Pass all AWB numbers for error handling
      return this.errorHelper.handleHttpError(
        error,
        data.cAwbNumbers, // Pass the entire array of AWB numbers
        "CANCEL_ORDER"
      );
    }
  }

  /**
   * Transform cancel order request into Shipyaari API format
   */
  private transformShipyaariCancelOrderPayload<T extends BaseCancelOrderDto>(
    data: T
  ): any {
    // For Shipyaari API, the AWBs should be in an array
    const transformedData = {
      awbs: data.cAwbNumbers,
    };

    this.logger.log(
      `[Shipyaari cancelOrder] Transformed request payload: ${JSON.stringify(transformedData)}`
    );

    return transformedData;
  }

  /**
   * Make API call to Shipyaari cancel order API
   */
  private async callShipyaariCancelOrderAPI(
    endpoint: EndpointConfigModel,
    payload: any,
    authHeaders: Record<string, string>,
    cAwbNumbers: string[] // Updated parameter type to string[]
  ): Promise<AxiosResponse<any>> {
    // Log request with all AWB numbers
    this.logger.log(
      `[Shipyaari cancelOrder] Request for AWBs - Payload: ${JSON.stringify(payload)}`
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint.url, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeaders["Authorization"],
          },
          // Use HTTPS agent for secure connections
          httpsAgent: this.httpsAgent,
          // Set timeout to avoid long-running requests
          timeout: 30000,
        })
      );

      this.logger.log(
        `[Shipyaari cancelOrder] Response for AWBs - ${JSON.stringify(response.data)}`
      );

      // Check if the response contains an API-level error despite HTTP success status
      const apiStatusCode = response.data?.statusCode;
      const isResponseError =
        response.data?.success === false ||
        apiStatusCode >= 400 ||
        (response.data?.message &&
          (response.data?.message.includes("Required") ||
            response.data?.message.includes("Error") ||
            response.data?.message.includes("Invalid")));

      // If we have an API-level error, throw an exception with the API status code
      if (isResponseError) {
        throw this.errorHelper.handleApiError(
          response.data,
          cAwbNumbers, // Pass all AWB numbers
          "CANCEL_ORDER"
        );
      }

      return response;
    } catch (error) {
      // Log all errors, not just network-related ones
      const errorData = {
        message: error.message || "Unknown error",
        code: error.code || "",
        status: error.response?.status || "",
        responseData: error.response?.data || {},
        awbNumbers: cAwbNumbers,
      };

      this.logger.error(
        `[Shipyaari cancelOrder] Error for AWBs: ${cAwbNumbers.join(",")} - ${JSON.stringify(errorData)}`,
        error.stack
      );

      throw error; // Let the calling method handle the error
    }
  }

  /**
   * Format Shipyaari API response into standard format
   */
  private formatCancelOrderResponse<R extends BaseResDto>(
    response: AxiosResponse<any>,
    originalData: BaseCancelOrderDto
  ): R {
    const result = new BaseResDto() as R;

    // Extract key information from the response
    const apiMessage = response.data.message || "Order cancelled successfully";

    // Use API status code for successful responses too
    result.statusCode = response.data?.statusCode || 200;
    // Set generic success message at root level
    result.message = "Shipyaari Cancel Order API success";
    // Add partner code at root level
    result.partnerCode = this.partnerCode;

    // Create a simplified data structure with only essential fields
    result.data = {
      success: true,
      status: "CANCELLED",
      message: apiMessage,
      cAwbNumbers: originalData.cAwbNumbers,
    };

    result.trace = {
      timestamp: new Date().toISOString(),
      operation: "CANCEL_ORDER",
    };

    return result;
  }


  /**
   * Create an order with Shipyaari using V2 payload
   * Direct implementation for createOrderV2
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      // Get auth token
      const authHeaders = await this.authService.getAuthHeadersV2();

      // Transform the payload for V2
      const transformedData = this.transformShipyaariCreateOrderV2Payload(orderDetails);

      // Make API call to new Shipyaari API endpoint
      const { response, requestUrl, requestBody } = await this.callShipyaariCreateOrderV2API(
        transformedData,
        authHeaders,
        orderDetails.awbNumber || ""
      );

      // Format and return response
      return this.formatCreateOrderResponse<R>(response, requestUrl, requestBody);
    } catch (error) {
      // If this is a CustomHttpException, throw it with HTTP error
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // For other errors, use the error helper to handle them properly
      return this.errorHelper.handleHttpError(
        error,
        orderDetails.awbNumber || "",
        "CREATE_ORDER_V2"
      );
    }
  }



  

  /**
   * Transform V2 order request into Shipyaari API format
   * Maps parentShipment and childShipments to boxInfo structure
   */
  private transformShipyaariCreateOrderV2Payload<T extends BaseOrderReqDtoV2>(
    orderDetails: T
  ): any {
    // Extract all line items from parent and child shipments
    const lineItems = extractLineItems(orderDetails);

    // Find pickup and delivery addresses
    const pickupAddress = orderDetails.addresses?.find((a: any) => a.type === "PICKUP") || {} as any;
    const deliveryAddress = orderDetails.addresses?.find((a: any) => a.type === "DELIVERY") || {} as any;

    // Gather all shipments: parent + children
    const shipments = [
      orderDetails.parentShipment,
      ...(orderDetails.childShipments || []),
    ].filter(Boolean);

    // Map each shipment to a box
    const boxInfo = shipments.map((shipment, idx) => {
      // Find line items for this specific shipment
      const shipmentItems = shipment.items || [];
      
      return {
        name: `box_${idx + 1}`,
        type: "parcel",
        weightUnit: "Kg",
        deadWeight: parseFloat(shipment.physicalWeight || "2") / 1000, // Convert to kg
        length: parseFloat(shipment.dimensions?.length || "1"),
        breadth: parseFloat(shipment.dimensions?.width || "1"),
        height: parseFloat(shipment.dimensions?.height || "1"),
        qty: 1,
        discount: parseFloat(shipment.discount || "0"),
        measureUnit: "cm",
        products: shipmentItems.map((item: any) => ({
          name: item.name || "Product",
          category: item.category || "",
          sku: item.sku || "",
          hsnCode: item.hsnCode || "",
          qty: item.quantity || 1,
          unitPrice: parseFloat(item.unitPrice || "0"),
          discount: parseFloat(item.discount || "0"),
          unitTax: parseFloat(item.taxes?.[0]?.amount || "0"),
          sellingPrice: parseFloat(item.unitPrice || "0"),
          totalDiscount: parseFloat(item.discount || "0"),
          totalPrice: parseFloat(item.unitPrice || "0"),
          weightUnit: "kg",
          deadWeight: parseFloat(item.weight || "2") / 1000,
          length: parseFloat(item.dimensions?.length || "1"),
          breadth: parseFloat(item.dimensions?.width || "1"),
          height: parseFloat(item.dimensions?.height || "1"),
          measureUnit: "cm",
          images: []
        })),
        codInfo: {
          isCod: orderDetails.payment?.type === "COD",
          collectableAmount: orderDetails.payment?.type === "COD" 
            ? parseFloat(orderDetails.payment.finalAmount || "0") 
            : 0,
          invoiceValue: parseFloat(orderDetails.payment?.finalAmount || "0")
        },
        podInfo: {
          isPod: false
        },
        insurance: false
      };
    });

    const transformedData = {
      pickupDetails: {
        addressType: "warehouse",
        fullAddress: `${pickupAddress.address1 || ""} ${pickupAddress.address2 ? pickupAddress.address2 + ", " : ""}${pickupAddress.city || ""}, ${pickupAddress.state || ""} ${pickupAddress.zip || pickupAddress.postalCode || ""}`,
        pincode: parseInt(pickupAddress.zip || pickupAddress.postalCode || "0"),
        startTime: "08",
        endTime: "09",
        latitude: pickupAddress.latitude || "0",
        longitude: pickupAddress.longitude || "0",
        contact: {
          name: pickupAddress.name || "",
          mobileNo: parseInt(pickupAddress.mobile || pickupAddress.phone || "0"),
          alternateMobileNo: parseInt(pickupAddress.alternateMobile || pickupAddress.phone || "0")
        }
      },
      deliveryDetails: {
        addressType: "warehouse",
        fullAddress: `${deliveryAddress.address1 || ""} ${deliveryAddress.address2 ? deliveryAddress.address2 + ", " : ""}${deliveryAddress.city || ""}, ${deliveryAddress.state || ""} ${deliveryAddress.zip || deliveryAddress.postalCode || ""}`,
        pincode: parseInt(deliveryAddress.zip || deliveryAddress.postalCode || "0"),
        startTime: "10",
        endTime: "11",
        latitude: deliveryAddress.latitude || "0",
        longitude: deliveryAddress.longitude || "0",
        contact: {
          name: deliveryAddress.name || "",
          mobileNo: parseInt(deliveryAddress.mobile || deliveryAddress.phone || "0"),
          alternateMobileNo: parseInt(deliveryAddress.alternateMobile || deliveryAddress.phone || "0")
        },
        gstNumber: deliveryAddress.gstNumber || ""
      },
      boxInfo: boxInfo,
      orderType: "B2C",
      transit: "FORWARD",
      courierPartner: "",
      courierPartnerServices: "",
      serviceMode: "AIR",
      giftCharges: parseFloat((orderDetails.metadata as any)?.giftCharges || "0"),
      shippingCharges: parseFloat((orderDetails.metadata as any)?.shippingCharges || "0"),
      transactionCharges: parseFloat((orderDetails.metadata as any)?.transactionCharges || "0"),
      advanceAmountPaid: parseFloat((orderDetails.metadata as any)?.advanceAmountPaid || "0"),
      servicePriority: "cheapest",
      source: "",
      qcType: "DoorStep",
      returnReason: (orderDetails.metadata as any)?.returnReason || "",
      orderFutureDate: (orderDetails.metadata as any)?.orderFutureDate || "",
      pickupDate: new Date().getTime().toString(),
      gstNumber: deliveryAddress.gstNumber || "",
      childGstNumber: deliveryAddress.gstNumber || "",
      parentId: 1,
      childId: 2,
      orderId: orderDetails.orderId || "",
      eWayBillNo: orderDetails.eWaybills?.[0] || "",
      brandName: (orderDetails.metadata as any)?.brandName || orderDetails.metadata?.source || "",
      brandLogo: (orderDetails.metadata as any)?.brandLogo || ""
    };

    this.logger.log(
      `[Shipyaari createOrderV2] Transformed request payload: ${JSON.stringify(transformedData)}`
    );

    return transformedData;
  }

  /**
   * Make API call to Shipyaari order API
   */
  

  /**
   * Make API call to Shipyaari V2 order API
   */
  private async callShipyaariCreateOrderV2API(
    payload: any,
    authHeaders: Record<string, string>,
    awbNumber: string
  ): Promise<{ response: AxiosResponse<any>; requestUrl: string; requestBody: any }> {
    // Log request
    this.logger.log(
      `[Shipyaari createOrderV2] Request for AWB: ${awbNumber} - Payload: ${JSON.stringify(payload)}`
    );

    try {
      // Get the endpoint URL from environment variable
      const apiUrl = this.configService.get<string>("SHIPYAARI_CREATE_ORDER_URL")

      const response = await firstValueFrom(
        this.httpService.post(apiUrl, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeaders["Authorization"],
          },
          // Use HTTPS agent for secure connections
          httpsAgent: this.httpsAgent,
          // Set timeout to avoid long-running requests
          timeout: 30000,
        })
      );

      this.logger.log(
        `[Shipyaari createOrderV2] Response for AWB: ${awbNumber} - ${JSON.stringify(response.data)}`
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
          "CREATE_ORDER_V2"
        );
      }

      return { response, requestUrl: apiUrl, requestBody: payload };
    } catch (error) {
      // Log all errors, not just network-related ones
      const errorData = {
        message: error.message || "Unknown error",
        code: error.code || "",
        status: error.response?.status || "",
        responseData: error.response?.data || {},
        stack: error.stack,
      };

      this.logger.error(
        `[Shipyaari createOrderV2] Error for AWB: ${awbNumber} - ${JSON.stringify(errorData)}`,
        error.stack
      );

      this.errorHelper.handleHttpError(error, awbNumber, "CREATE_ORDER_V2");
    }
  }

  

  /**
   * Format Shipyaari API response into standard format
   */
 


  /**
   * Override validation method if needed for Shipyaari-specific validation
   */
  protected validateInputForOperation(operation: string, data: any): boolean {
    // Add Shipyaari-specific validation if needed
    return super.validateInputForOperation(operation, data);
  }
}
