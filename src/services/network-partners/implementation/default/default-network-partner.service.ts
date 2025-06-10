import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import {
  PARTNER_CODE_ENUM,
  ENDPOINT_ID_ENUM,
} from "src/common/enums/global.enum";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { DefaultAuthService } from "./default-auth.service";
import {
  BaseCancelOrderDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
  ManifestReqDto,
} from "src/common/dtos/base.dto";
import { BaseNetworkPartnerHelper } from "../../base/base-network-partner-helper.service";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import {
  pushOrdersToPRSDto,
  StandardRequestDto,
} from "src/services/distributor/distributor.service";
import { firstValueFrom } from "rxjs";
import {
  CustomHttpException,
  TemporalErrorHandler,
} from "src/infrastructure/exception-handlers";
import { SOURCE_CONST } from "src/common/constants";
/**
 * Default implementation of the network partner for when a specific
 * partner implementation is not found.
 * Uses the base network partner implementation with the partner code from
 * the request data to fetch the correct endpoint configurations.
 */
@Injectable()
export class DefaultNetworkPartner extends BaseNetworkPartner {
  constructor(
    private readonly defaultAuthService: DefaultAuthService,
    httpService: HttpService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>,
    private readonly baseNetworkPartnerHelper: BaseNetworkPartnerHelper
  ) {
    // Initialize with DEFAULT but this isn't really used for operations
    super(
      PARTNER_CODE_ENUM.DEFAULT,
      defaultAuthService,
      httpService,
      endpointConfigRepository,
      schemaMapper,
      baseNetworkPartnerHelper
    );
  }

  // Override methods to use partner code from the request data
  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${orderDetails.partnerCode}`
    );
    // Set the partner code from the request data
    (this as any).partnerCode = orderDetails.partnerCode;
    return await super.createOrder<T, R>(
      orderDetails,
      partnerCode,
      eligiblePartners
    );
  }

  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${manifestationDetails.partnerCode}`
    );
    // Set the partner code from the request data
    (this as any).partnerCode = manifestationDetails.partnerCode;
    return await super.createManifest<T, R>(manifestationDetails);
  }

  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${params.partnerCode}`
    );
    // Set the partner code from the request data
    (this as any).partnerCode = params.partnerCode;
    return await super.getOrderDetails<T, R>(params);
  }

  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    // Set the partner code from the request data
    (this as any).partnerCode = data.partnerCode;
    return await super.cancelOrder<T, R>(data);
  }

  async pushOrdersToPRS<T extends pushOrdersToPRSDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    return await super.pushOrdersToPRS<T, R>(data);
  }

  private async getEndpoint(partnerCode: string, endpointId: string) {
    const endpoint = await this.endpointConfigRepository.getOne({
      partnerCode,
      endpointId,
    });

    if (!endpoint) {
      const customError = new CustomHttpException(
        HttpStatus.NOT_FOUND,
        `Endpoint configuration not found for ${partnerCode} - ${endpointId}`
      );

      // Convert to ApplicationFailure for Temporal compatibility
      TemporalErrorHandler.throwAsApplicationFailure(customError);
    }

    return endpoint;
  }

  private async makeApiCall<T>(
    url: string,
    body: T,
    operation: string = "API"
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            "Content-Type": "application/json",
          },
        })
      );

      // Include request body in success response
      if (response.data) {
        response.data = {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: body,
        };
      }

      return response;
    } catch (error) {
      this.logger.error(`Error making API call: ${error.message}`, error.stack);

      // Extract detailed error information
      const errorResponse = error.response || {};
      const errorData = errorResponse.data || {};
      const statusCode =
        errorResponse.status || HttpStatus.INTERNAL_SERVER_ERROR;

      // Construct meaningful error message for the data payload
      let detailedErrorMessage = "API request failed";
      if (typeof errorData === "string") {
        detailedErrorMessage = errorData;
      } else if (
        errorData.message ||
        errorData.error ||
        errorData.description
      ) {
        detailedErrorMessage =
          errorData.message || errorData.error || errorData.description;
      } else if (
        errorData.errors &&
        Array.isArray(errorData.errors) &&
        errorData.errors.length > 0
      ) {
        detailedErrorMessage = errorData.errors
          .map((e) => e.message || e)
          .join(", ");
      }

      // Log detailed error info
      this.logger.error(
        `API call failed with status ${statusCode}: ${detailedErrorMessage}`
      );
      this.logger.error(`Request URL: ${url}`);
      this.logger.error(`Request body: ${JSON.stringify(body)}`);
      this.logger.error(`Response data: ${JSON.stringify(errorData)}`);

      // Format the root message as [operation] API fail
      const rootMessage = `${operation} API fail`;

      const customError = new CustomHttpException(statusCode, rootMessage, {
        originalResponse: errorData,
        requestUrl: url,
        requestBody: body,
      });

      // Convert to ApplicationFailure for Temporal compatibility
      TemporalErrorHandler.throwAsApplicationFailure(customError);
    }
  }

  private buildOrderTrackingBody(data: BaseOrderReqDto) {
    const pickupAddress = data.pickupAddress;
    const shippingAddress = data.shippingAddress;

    const body = {
      trackingId: data.awbNumber,
      cAwbNumber: data.cAwbNumber,
      smileAwbNumber: data?.smileAwbNumber,
      type: data?.type,
      sourceLocation: {
        city: pickupAddress.city,
        state: pickupAddress.state,
        pincode: pickupAddress.zip,
        landmark: pickupAddress.address2 || "",
      },
      destinationLocation: {
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.zip,
        landmark: shippingAddress.address2 || "",
      },
      orderMetaData: [],
    };

    this.addCarrierMetadata(body, data);
    return body;
  }

  private addCarrierMetadata(body: any, data: BaseOrderReqDto) {
    if ("carrierName" in data && data.carrierName === "SHIPYAARI") {
      body.orderMetaData.push(
        {
          deliveryPartnerName: "SHIPSY",
          mile: "first",
        },
        {
          deliveryPartnerName: data.carrierName,
          mile: "last",
        }
      );
    } else if ("carrierName" in data && data.carrierName === "SHIPSY") {
      body.orderMetaData.push({
        deliveryPartnerName: data.carrierName,
        mile: "first",
      });
    }
  }

  private buildManifestTrackingBody(data: BaseOrderReqDto) {
    return {
      status: "ready_for_dispatch",
      deliveryPartnerName: "innofulfill",
      event: "ready_for_dispatch",
      location: data.pickupAddress
        ? `${data.pickupAddress.address1}, ${data.pickupAddress.address2 || ""}, ${data.pickupAddress.zip}, ${data.pickupAddress.city}, ${data.pickupAddress.state}, ${data.pickupAddress.country}`
        : "",
      trackingId: data.awbNumber,
      cAwbNumber: data.cAwbNumber,
      smileAwbNumber: data?.smileAwbNumber,
      statusTimestamp: Math.floor(Date.now() / 1000).toString(),
    };
  }

  async pushOrderToTracking<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    (this as any).partnerCode = data.partnerCode;

    try {
      const endpoint = await this.getEndpoint(
        data.partnerCode,
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_TRACKING
      );

      this.logger.log(`Sending order to tracking API: ${endpoint.url}`);

      const body = this.buildOrderTrackingBody(data.order as BaseOrderReqDto);
      this.logger.log("Order info body sent to tracking", body);

      const response = await this.makeApiCall(endpoint.url, body, "Tracking");

      return this.createSuccessResponse<R>(
        response.data,
        "Order successfully pushed to tracking"
      );
    } catch (error) {
      // Let the error propagate up, makeApiCall already formats it properly
      throw error;
    }
  }

  async manifestOrderToTracking<
    T extends StandardRequestDto,
    R extends BaseResDto,
  >(data: T): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    (this as any).partnerCode = data.partnerCode;

    try {
      const endpoint = await this.getEndpoint(
        data.partnerCode,
        ENDPOINT_ID_ENUM.MANIFEST_ORDER_TO_TRACKING
      );

      this.logger.log(
        `Sending manifest order to tracking API: ${endpoint.url}`
      );

      const body = this.buildManifestTrackingBody(
        data.order as BaseOrderReqDto
      );
      this.logger.log("Manifest info body sent to tracking", body);

      const response = await this.makeApiCall(
        endpoint.url,
        body,
        "Manifest Tracking"
      );

      return this.createSuccessResponse<R>(
        response.data,
        "Order successfully manifested to tracking"
      );
    } catch (error) {
      // Let the error propagate up, makeApiCall already formats it properly
      throw error;
    }
  }

  async pushOrderToDRS<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    (this as any).partnerCode = data.partnerCode;

    try {
      const endpoint = await this.getEndpoint(
        data.partnerCode,
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_DRS
      );

      this.logger.log(`Sending order to DRS API: ${endpoint.url}`);

      const body = this.buildDrsPayload(data.order as BaseOrderReqDto);
      this.logger.log("DRS payload body sent to API", body);

      const response = await this.makeApiCall(endpoint.url, body, "DRS");

      // Check if the API response indicates failure
      const originalResponse = response.data?.originalResponse;
      const responseStatus =
        originalResponse?.status || originalResponse?.statusCode;
      if (originalResponse && responseStatus !== 200) {
        // Extract error details from the response
        let errorMessage = "DRS API failed";
        if (originalResponse.data && Array.isArray(originalResponse.data)) {
          const errorDetails = originalResponse.data
            .map((item: any) => item.message || "Unknown error")
            .join(", ");
          errorMessage = `DRS API failed: ${errorDetails}`;
        } else if (originalResponse.message) {
          errorMessage = `DRS API failed: ${originalResponse.message}`;
        }

        this.logger.error(
          `DRS API returned error: ${JSON.stringify(originalResponse)}`
        );

        const customError = new CustomHttpException(
          responseStatus || HttpStatus.BAD_REQUEST,
          "DRS API fail",
          response.data // Keep the same response structure with originalResponse, requestUrl, requestBody
        );

        // Convert to ApplicationFailure for Temporal compatibility
        TemporalErrorHandler.throwAsApplicationFailure(customError);
      }

      return this.createSuccessResponse<R>(
        response.data,
        "Order successfully pushed to DRS"
      );
    } catch (error) {
      // Let the error propagate up, makeApiCall already formats it properly
      throw error;
    }
  }

  private buildDrsPayload(data: BaseOrderReqDto) {
    const serviceTypeNames = ["vayuquick", "vayuquick_pro"];
    const serviceType = {
      name: data.serviceType,
      isVisible: serviceTypeNames.includes(data.serviceType) ? true : false,
      icon: serviceTypeNames.includes(data.serviceType)
        ? data.serviceType === "vayuquick"
          ? `https://${process.env.S3_BUCKET_NAME}.s3.ap-south-1.amazonaws.com/drs_pod/fastrack_icons/vayu_quick.png`
          : `https://${process.env.S3_BUCKET_NAME}.s3.ap-south-1.amazonaws.com/drs_pod/fastrack_icons/vayu_quick_pro.png`
        : "",
    };

    return {
      cAWB_No: data.cAwbNumber || data.awbNumber,
      AWB_No: data.awbNumber,
      created_at: data.orderCreatedDate,
      payload: {
        cAWB_No: data.cAwbNumber || data.awbNumber,
        deliveryDetails: {
          name: data.shippingAddress.name,
          address:
            `${data.shippingAddress.address1} ${data.shippingAddress.address2 || ""}`.trim(),
          pincode: data.shippingAddress.zip,
          phoneNo: data.shippingAddress.mobile,
          email: data?.shippingAddress?.email || null,
        },
        // TODO: Make it dynamic and take from the order data
        deliveryTypeOptions: "image",
        paymentType: data.paymentDetails?.isCOD ? "COD" : "PREPAID",
        deadWeight: Number(data.dimensions?.weight) || null,
        length: data.dimensions?.length || 0,
        width: data.dimensions?.breadth || 0,
        height: data.dimensions?.height || 0,
      },
      shipmentType: data.type,
      shippingType: data.shippingType,
      shipmentStatus: data.orderStatus,
      source: "ORCHESTRATION",
      serviceType,
    };
  }

  async pushOrderToHubOps<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    (this as any).partnerCode = data.partnerCode;

    try {
      const endpoint = await this.getEndpoint(
        data.partnerCode,
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_HUBOPS
      );

      this.logger.log(`Sending order to HubOps API: ${endpoint.url}`);

      const body = this.buildHubOpsPayload(data.order as BaseOrderReqDto);
      this.logger.log("HubOps payload body sent to API", body);

      const response = await this.makeApiCall(endpoint.url, body, "HubOps");

      // TODO: PATCHWORK FIX - Remove this and properly handle HubOps API errors
      // Currently returning success even for API failures to prevent workflow interruption
      // Original error handling should be restored once HubOps API issues are resolved

      // Check if the API response indicates failure
      const originalResponse = response.data?.originalResponse;
      if (originalResponse && originalResponse.statusCode !== 200) {
        // Log the error but don't throw - temporary patchwork solution
        this.logger.error(
          `HubOps API returned error but continuing as success (PATCHWORK): ${JSON.stringify(originalResponse)}`
        );

        // Return success response with the original error data intact
        return this.createSuccessResponse<R>(
          response.data, // Keep original response structure with error details
          "Order processed for HubOps (with API errors - patchwork fix)"
        );
      }

      return this.createSuccessResponse<R>(
        response.data,
        "Order successfully pushed to HubOps"
      );
    } catch (error) {
      // Let the error propagate up, makeApiCall already formats it properly
      throw error;
    }
  }

  private buildHubOpsPayload(order: BaseOrderReqDto) {
    // Determine AWB number based on priority
    let awbNum;
    if (order.smileAwbNumber) {
      awbNum = parseInt(order.smileAwbNumber);
    } else if (
      order.partnerCode === PARTNER_CODE_ENUM.SMILE &&
      order.cAwbNumber
    ) {
      awbNum = parseInt(order.cAwbNumber);
    } else {
      awbNum = parseInt(order.awbNumber);
    }

    // Create the booking payload and wrap it in an array
    return [
      {
        awbNumber: awbNum,
        bookingStatus: order.orderStatus,
        bookingType: order.type,
        // ewayBillCreateDate: null,
        ewayBillNumber: order?.ewayBillNos?.[0] || "",
        docType: order?.type === "COURIER" ? order?.deliveryMode : "",
        // expiryDate: null,
        extendEwayBillCount: 0,
        fromPincode: parseInt(order?.pickupAddress?.zip),
        height: order?.dimensions?.height || 0,
        length: order?.dimensions?.length || 0,
        modeOfPayment: order?.paymentDetails?.isCOD ? "COD" : "PREPAID",
        receiverAddressLine: order?.shippingAddress?.address1 || "",
        receiverCity: order?.shippingAddress?.city || "",
        receiverMobileNumber: parseInt(order?.shippingAddress?.mobile) || 0,
        receiverName: order?.shippingAddress?.name || "",
        receiverPincode: parseInt(order?.shippingAddress?.zip) || 0,
        receiverState: order?.shippingAddress?.state || "",
        senderAddressLine: order?.pickupAddress?.address1 || "",
        senderCity: order?.pickupAddress?.city || "",
        senderName: order?.pickupAddress?.name || "",
        senderPincode: parseInt(order?.pickupAddress?.zip) || 0,
        senderState: order?.pickupAddress?.state || "",
        service: order?.serviceType || "",
        source: SOURCE_CONST.ORCHESTRATOR,
        // TODO: Make it dynamic based on the serviceability partner selection
        mcn: order?.partnerCode === PARTNER_CODE_ENUM.SHIPYAARI ? true : false,
        time: "",
        toPincode: parseInt(order?.shippingAddress?.zip) || 0,
        travelBy: order?.travelType || "",
        value: order?.paymentDetails?.amount || 0,
        volumetricWeight: 0,
        weight: order?.dimensions?.weight || 0,
        width: order?.dimensions?.breadth || 0,
      },
    ];
  }

  async updateEcomOrderWebhook<
    T extends StandardRequestDto,
    R extends BaseResDto,
  >(data: T): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    (this as any).partnerCode = data.partnerCode;

    try {
      const endpoint = await this.getEndpoint(
        data.partnerCode,
        ENDPOINT_ID_ENUM.SELLER_ECOMM_WEBHOOK
      );

      const awbNumber = data.order.awbNumber;

      this.logger.log(`Updating ecom order details for AWB: ${awbNumber}`);

      // Build the URL with the awbNumber path parameter
      const url = endpoint.url.replace("{awbNumber}", awbNumber);

      // Create the request payload
      const body = {
        cAwbNumber: data.order.cAwbNumber,
        firstMileHub: data.order.firstMileHub,
      };

      this.logger.log("Request payload for ecom order update:", body);

      // Make PATCH request
      const response = await this.makePatchApiCall(url, body, "Ecom Update");

      return this.createSuccessResponse<R>(
        response.data,
        "Ecommerce order details updated successfully"
      );
    } catch (error) {
      // Let the error propagate up, makePatchApiCall already formats it properly
      throw error;
    }
  }

  private async makePatchApiCall<T>(
    url: string,
    body: T,
    operation: string = "PATCH"
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.patch(url, body, {
          headers: {
            "Content-Type": "application/json",
          },
        })
      );

      // Include request body in success response
      if (response.data) {
        response.data = {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: body,
        };
      }

      return response;
    } catch (error) {
      this.logger.error(
        `Error making PATCH API call: ${error.message}`,
        error.stack
      );

      // Extract detailed error information
      const errorResponse = error.response || {};
      const errorData = errorResponse.data || {};
      const statusCode =
        errorResponse.status || HttpStatus.INTERNAL_SERVER_ERROR;

      // Construct meaningful error message for the data payload
      let detailedErrorMessage = "API request failed";
      if (typeof errorData === "string") {
        detailedErrorMessage = errorData;
      } else if (
        errorData.message ||
        errorData.error ||
        errorData.description
      ) {
        detailedErrorMessage =
          errorData.message || errorData.error || errorData.description;
      } else if (
        errorData.errors &&
        Array.isArray(errorData.errors) &&
        errorData.errors.length > 0
      ) {
        detailedErrorMessage = errorData.errors
          .map((e) => e.message || e)
          .join(", ");
      }

      // Log detailed error info
      this.logger.error(
        `PATCH API call failed with status ${statusCode}: ${detailedErrorMessage}`
      );
      this.logger.error(`Request URL: ${url}`);
      this.logger.error(`Request body: ${JSON.stringify(body)}`);
      this.logger.error(`Response data: ${JSON.stringify(errorData)}`);

      // Format the root message as [operation] API fail
      const rootMessage = `${operation} API fail`;

      const customError = new CustomHttpException(statusCode, rootMessage, {
        originalResponse: errorData,
        requestUrl: url,
        requestBody: body,
      });

      // Convert to ApplicationFailure for Temporal compatibility
      TemporalErrorHandler.throwAsApplicationFailure(customError);
    }
  }
}
