import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import {
  PARTNER_CODE_ENUM,
  ENDPOINT_ID_ENUM,
  ORDER_TYPE_ENUM,
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
import { BaseCancelOrderDtoV2 } from "src/common/dtos/base2.dto";
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

  /**
   * Cancel order V2 with handling for special partner codes like BULK_OPERATION
   */
  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.log(
      `Cancelling Order V2 with partner ${partnerCode}`
    );

    // Handle BULK_OPERATION as a special case - no external API call needed
    if (partnerCode === 'BULK_OPERATION') {
      this.logger.log(
        `BULK_OPERATION detected - returning success without external API call`
      );
      return {
        statusCode: 200,
        message: 'Order cancellation processed successfully (BULK_OPERATION)',
        partnerCode: partnerCode,
        data: {
          cAwbNumbers: data.cAwbNumbers,
          cancelReason: data.cancelReason,
          status: 'CANCELLED',
        },
        trace: {
          timestamp: new Date().toISOString(),
          partnerCode: partnerCode,
          operation: 'CANCEL_ORDER_V2',
        },
      } as R;
    }

    // Set the partner code from the request data
    (this as any).partnerCode = partnerCode;
    return await super.cancelOrderV2<T, R>(data, partnerCode, eligiblePartners);
  }

  // async pushOrdersToPRS<T extends pushOrdersToPRSDto, R extends BaseResDto>(
  //   data: T
  // ): Promise<R> {
  //   this.logger.log(
  //     `Using base implementation for partner code: ${data.partnerCode}`
  //   );
  //   return await super.pushOrdersToPRS<T, R>(data);
  // }

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
      clientIdSevasetu: data?.clientIdSevasetu,
      childTrackingIds: data?.childAwbs,
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
      senderDetails: {
        sender_mobile: pickupAddress.mobile,
        sender_name:pickupAddress.name
      },
      receiverDetails: {
        receiver_mobile: shippingAddress.mobile,
        receiver_name:shippingAddress.name
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

  async buildPrsPayload(data: BaseOrderReqDto) {
    return {
      vendorCode: data?.sellerInfo?.vendorCode,
      originalOrderId: data.awbNumber,
      type: data.type,
      weight: data.dimensions?.weight,
      mcnOrder: this.determineMcnFlag(data, data.partnerCode),
      shippingAddress: {
        name: data.shippingAddress.name,
        phone: data.shippingAddress.mobile,
        address1: data.shippingAddress.address1,
        address2: data.shippingAddress.address2,
        city: data.shippingAddress.city,
        state: data.shippingAddress.state,
        country: data.shippingAddress.country,
        zip: data.shippingAddress.zip,
        geoLocation: {
          type: "Point",
          coordinates: [
            data.shippingAddress.longitude,
            data.shippingAddress.latitude,
          ],
        },
        innoCity: data.shippingAddress.city,
        innoState: data.shippingAddress.state,
      },
      sellerName: data?.sellerInfo?.name,
      carrierName: data.partnerCode,
      pickupAddress: {
        name: data.pickupAddress.name,
        phone: data.pickupAddress.mobile,
        address1: data.pickupAddress.address1,
        address2: data.pickupAddress.address2,
        city: data.pickupAddress.city,
        state: data.pickupAddress.state,
        country: data.pickupAddress.country,
        zip: data.pickupAddress.zip,
        geoLocation: {
          type: "Point",
          coordinates: [
            data.pickupAddress.longitude,
            data.pickupAddress.latitude,
          ],
        },
        innoCity: data.pickupAddress.city,
        innoState: data.pickupAddress.state,
      },
      sellerInfo: {
        name: data?.sellerInfo?.name,
        mobile: data?.sellerInfo?.mobile,
        companyName: data?.sellerInfo?.companyName,
      },
      awbNumber: data.awbNumber,
      cAwbNumber: data.cAwbNumber || data.awbNumber,
    };
  }

  async pushOrdersToPRS<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    (this as any).partnerCode = data.partnerCode;

    try {
      const endpoint = await this.getEndpoint(
        data.partnerCode,
        ENDPOINT_ID_ENUM.PUSH_ORDERS_TO_PRS
      );

      this.logger.log(`Sending order to PRS API: ${endpoint.url}`);

      const body = await this.buildPrsPayload(data.order as BaseOrderReqDto);
      this.logger.log("PRS payload body sent to API", body);

      const response = await this.makeApiCall(endpoint.url, body, "PRS");

      // Check if the API response indicates failure
      const originalResponse = response.data?.originalResponse;
      const responseStatus =
        originalResponse?.status || originalResponse?.statusCode;
      if (
        originalResponse &&
        responseStatus !== 200 &&
        responseStatus !== 201
      ) {
        // Extract error details from the response
        let errorMessage = "PRS API failed";
        if (originalResponse.data && Array.isArray(originalResponse.data)) {
          const errorDetails = originalResponse.data
            .map((item: any) => item.message || "Unknown error")
            .join(", ");
          errorMessage = `PRS API failed: ${errorDetails}`;
        } else if (originalResponse.message) {
          errorMessage = `PRS API failed: ${originalResponse.message}`;
        }

        this.logger.error(
          `PRS API returned error: ${JSON.stringify(originalResponse)}`
        );

        const customError = new CustomHttpException(
          responseStatus || HttpStatus.BAD_REQUEST,
          "PRS API fail",
          response.data // Keep the same response structure with originalResponse, requestUrl, requestBody
        );

        // Convert to ApplicationFailure for Temporal compatibility
        TemporalErrorHandler.throwAsApplicationFailure(customError);
      }

      // Return consistent response structure like DRS API
      return {
        statusCode: HttpStatus.OK,
        message: "Order successfully pushed to PRS",
        data: response.data, // This already contains originalResponse, requestUrl, requestBody from makeApiCall
      } as R;
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

    // Extract child AWB numbers (childShipments is a string array in BaseOrderReqDto)
    const childAwbs = data.childShipments || data.childAwbs || [];
    // Extract child CAWB numbers if available (checking for childCawbs field in data)
    const childCawbs = data.childShipments || data.childAwbs || [];

    return {
      cAWB_No: data.cAwbNumber || data.awbNumber,
      AWB_No: data.awbNumber,
      created_at: data.orderCreatedDate,
      isMcn: data.mcn,
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
      shipmentType: data?.type?.toUpperCase(),
      shippingType: data.shippingType,
      shipmentStatus: data.orderStatus,
      source: "ORCHESTRATION",
      serviceType,
      childAwbs,
      childCawbs,
    };
  }

  async pushOrderToHubOps<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    // (this as any).partnerCode = data.partnerCode;

    try {
      const endpoint = await this.getEndpoint(
        PARTNER_CODE_ENUM.SMILE,
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_HUBOPS
      );

      this.logger.log(`Sending order to HubOps API: ${endpoint.url}`);

      const body = this.buildHubOpsPayload(
        data.order as BaseOrderReqDto,
        data.partnerCode
      );
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

  private buildHubOpsPayload(order: BaseOrderReqDto, partnerCode: string) {
    // Determine AWB number based on priority
    // let awbNum;
    // if (order.smileAwbNumber) {
    //   awbNum = order.smileAwbNumber;
    // } else if (
    //   order.partnerCode === PARTNER_CODE_ENUM.SMILE &&
    //   order.cAwbNumber
    // ) {
    //   awbNum = order.cAwbNumber;
    // } else {
    //   awbNum = order.awbNumber;
    // }

    // Create the booking payload and wrap it in an array
    return [
      {
        awbNumber: order.awbNumber,
        bookingStatus: order.orderStatus,
        bookingType: order.type.toUpperCase(),
        // ewayBillCreateDate: null,
        ewayBillNumber: Array.isArray(order?.ewayBillNos)
          ? order.ewayBillNos.filter((n: any) => !!n).join(",")
          : order?.ewayBillNos || "",
        docType:
          order?.type.toUpperCase() === "COURIER"
            ? order?.deliveryMode
            : "non-dox",
        // expiryDate: null,
        extendEwayBillCount: 0,
        fromPincode: parseInt(order?.pickupAddress?.zip),
        height: order?.dimensions?.height || 0,
        length: order?.dimensions?.length || 0,
        modeOfPayment: order?.paymentDetails?.isCOD ? "COD" : "PREPAID",
        receiverAddressLine1: order?.shippingAddress?.address1 || "",
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
        childAwbs: order?.childShipments || [],
        // TODO: Make it dynamic based on the serviceability partner selection
        mcn: this.determineMcnFlag(order, partnerCode),
        partnerCode: order?.partnerCode || "",
        time: "",
        toPincode: parseInt(order?.shippingAddress?.zip) || 0,
        travelBy: order?.travelType || "",
        value: order?.shipmentValue || 0,
        description: order?.remarks || "",
        sourcePremiseId: order?.cpId || "",
        volumetricWeight: 0,
        weight: order?.dimensions?.weight || 0,
        width: order?.dimensions?.breadth || 0,
      },
    ];
  }

  async updateOrderToHubOps<T extends StandardRequestDto, R extends BaseOrderResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Updating order to HubOps for partner code: ${data.partnerCode}`
    );
    (this as any).partnerCode = data.partnerCode;

    try {
      // Get base URL from environment variable
      const baseUrl = process.env.HUBOPS_BASE_URL || process.env.INNOFULFILL_BASE_URL;
      
      if (!baseUrl) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "HUBOPS_BASE_URL or INNOFULFILL_BASE_URL environment variable is not configured"
        );
      }

      // Get AWB number for the URL path
      const orderData = data.order as BaseOrderReqDto;
      const awbNumber = orderData.awbNumber;

      if (!awbNumber) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "AWB number is required for updating order in HubOps"
        );
      }

      // Build the URL with the awbNumber path parameter
      const url = `${baseUrl}/update-booking/${awbNumber}`;

      this.logger.log(`Updating order in HubOps API: ${url}`);

      const body = this.buildHubOpsUpdatePayload(data.order as BaseOrderReqDto);
      this.logger.log("HubOps update payload body sent to API", body);

      // Make PUT request with custom headers
      const response = await this.makeHubOpsPutApiCall(
        url,
        body,
        "HubOps Update"
      );

      // Transform response to BaseOrderResDto format
      return this.createSuccessResponse<R>(
        response.data,
        "Order successfully updated in HubOps"
      );
    } catch (error) {
      // Let the error propagate up, makeHubOpsPutApiCall already formats it properly
      throw error;
    }
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

  /**
   * Build payload for HubOps update operation
   * Transforms BaseOrderReqDto to the format required by HubOps update-booking API
   */
  private buildHubOpsUpdatePayload(order: BaseOrderReqDto) {
    // Transform ewayBillNos array to ewayBills format
    const ewayBills = [];
    if (order?.ewayBillNos && Array.isArray(order.ewayBillNos)) {
      ewayBills.push(
        ...order.ewayBillNos
          .filter((ewayBillNo) => ewayBillNo && ewayBillNo.trim() !== "")
          .map((ewayBillNo) => ({
            ewaybillNo: ewayBillNo,
          }))
      );
    }

    return {
      destinationPincode: parseInt(order?.shippingAddress?.zip) || 0,
      travelBy: order?.travelType || "",
      receiverAddressLine1: order?.shippingAddress?.address1 || "",
      receiverAddressLine2: order?.shippingAddress?.address2 || "",
      ewayBills: ewayBills.length > 0 ? ewayBills : undefined,
      senderAddressLine: order?.pickupAddress?.address1 || "",
      senderCity: order?.pickupAddress?.city || "",
      senderState: order?.pickupAddress?.state || "",
      senderPincode: parseInt(order?.pickupAddress?.zip) || 0,
      senderName: order?.pickupAddress?.name || "",
    };
  }

  /**
   * Make POST API call with HubOps specific headers
   */
  private async makeHubOpsApiCall<T>(
    url: string,
    body: T,
    operation: string = "HubOps POST",
    premiseId?: string,
    userId?: string
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
      this.logger.error(
        `Error making HubOps POST API call: ${error.message}`,
        error.stack
      );

      // Extract detailed error information
      const errorResponse = error.response || {};
      const errorData = errorResponse.data || {};
      const statusCode =
        errorResponse.status || HttpStatus.INTERNAL_SERVER_ERROR;

      // Construct meaningful error message for the data payload
      let detailedErrorMessage = "HubOps POST API request failed";
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
        `HubOps POST API call failed with status ${statusCode}: ${detailedErrorMessage}`
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

  /**
   * Make PUT API call with HubOps specific headers for updating orders
   */
  private async makeHubOpsPutApiCall<T>(
    url: string,
    body: T,
    operation: string = "HubOps PUT"
  ): Promise<any> {
    try {
      const headers = {
        "Content-Type": "application/json",
        // "SMCS-PREMISE-ID": process.env.HUBOPS_PREMISE_ID || "default-premise",
        // "USER-ID": process.env.HUBOPS_USER_ID || "default-user",
        "x-api-key": process.env.HUBOPS_API_KEY,
      };

      this.logger.log(`🔑 HubOps PUT headers: ${JSON.stringify(headers)}`);

      const response = await firstValueFrom(
        this.httpService.put(url, body, { headers })
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
        `Error making HubOps PUT API call: ${error.message}`,
        error.stack
      );

      // Extract detailed error information
      const errorResponse = error.response || {};
      const errorData = errorResponse.data || {};
      const statusCode =
        errorResponse.status || HttpStatus.INTERNAL_SERVER_ERROR;

      // Construct meaningful error message for the data payload
      let detailedErrorMessage = "HubOps Update API request failed";
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
        `HubOps PUT API call failed with status ${statusCode}: ${detailedErrorMessage}`
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

  private determineMcnFlag(
    order: BaseOrderReqDto,
    partnerCode: string
  ): boolean {
    if (order?.mcn !== undefined) {
      return order.mcn;
    }

    // Check if this is an international order (shipping outside India)
    const isInternational = order.type === ORDER_TYPE_ENUM.INTERNATIONAL;

    // Check if partner is SHIPYAARI (traditional MCN partner)
    const isShipyaari = partnerCode === PARTNER_CODE_ENUM.SHIPYAARI;

    const isDelhivery = partnerCode === PARTNER_CODE_ENUM.DELHIVERY;

    // Business logic for MCN flag:
    // 1. For SHIPYAARI: Always true for domestic orders, needs review for international
    // 2. For DHL: Typically used for international, may need different MCN logic
    // 3. For international orders: May have different MCN requirements regardless of partner

    return isInternational || isShipyaari || isDelhivery;
  }

  /**
   * Update partner information to HubOps for multiple shipments
   * Makes PUT requests for each shipment in the shipmentDetails array
   */
  async updatePartnerToHubOps<T extends any, R extends BaseResDto>(
    requestDto: T
  ): Promise<R> {
    this.logger.log(
      `Updating partner information to HubOps for multiple shipments`
    );

    try {
      // Extract shipmentDetails from the request data
      const shipmentDetails = (requestDto as any)?.shipmentDetails;

      if (!shipmentDetails || !Array.isArray(shipmentDetails)) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "No shipmentDetails found in request data"
        );
      }

      this.logger.log(
        `Processing ${shipmentDetails.length} shipments for partner update`
      );

      const results = [];
      const errors = [];

      // Process each shipment
      for (const shipment of shipmentDetails) {
        try {
          const result = await this.updateSinglePartnerToHubOps(shipment);
          results.push({
            awbNumber: shipment.awbNumber,
            status: "success",
            result,
          });

          this.logger.log(
            `✅ Successfully updated partner info for AWB: ${shipment.awbNumber}`
          );
        } catch (error) {
          this.logger.error(
            `❌ Failed to update partner info for AWB: ${shipment.awbNumber}`,
            error.message
          );

          errors.push({
            awbNumber: shipment.awbNumber,
            status: "failed",
            error: error.message,
          });
        }
      }

      // Return combined response
      return this.createSuccessResponse<R>(
        {
          totalShipments: shipmentDetails.length,
          successCount: results.length,
          errorCount: errors.length,
          results,
          errors,
        },
        `Partner information updated for ${results.length}/${shipmentDetails.length} shipments`
      );
    } catch (error) {
      this.logger.error(
        `Failed to update partner information to HubOps: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Update partner information for a single shipment
   */
  private async updateSinglePartnerToHubOps(shipment: any): Promise<any> {
    // Construct the URL directly using environment variable
    const baseUrl = process.env.SMILE_HUBOPS_BASE_URL;
    const url = `${baseUrl}/smcs-webapp/shipment-booking-service/v1/shipment/mcn/${shipment.awbNumber}`;

    this.logger.log(
      `Updating partner info for AWB ${shipment.awbNumber} at URL: ${url}`
    );

    // Build the request payload
    const body = {
      partnerCode: shipment.partnerName,
      mcnAwbNumber: shipment.partnerAwbNumber,
      tplTransporterId: shipment.transporterId,
    };

    this.logger.log(
      `Partner update payload for AWB ${shipment.awbNumber}:`,
      body
    );

    // Make the PUT request
    const response = await this.makeHubOpsPutApiCall(
      url,
      body,
      "Partner Update"
    );

    return response.data;
  }
}
