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
import { CustomHttpException } from "src/infrastructure/exception-handlers";

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

  private async getTrackingEndpoint(partnerCode: string, endpointId: string) {
    const endpoint = await this.endpointConfigRepository.getOne({
      partnerCode,
      endpointId,
    });

    if (!endpoint) {
      throw new CustomHttpException(
        HttpStatus.NOT_FOUND,
        `Endpoint configuration not found for ${partnerCode} - ${endpointId}`
      );
    }

    return endpoint;
  }

  private async makeTrackingApiCall<T>(url: string, body: T): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            "Content-Type": "application/json",
          },
        })
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Error making tracking API call: ${error.message}`,
        error.stack
      );
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to make tracking API call: ${error.message}`,
        error.response?.data || error
      );
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
      const endpoint = await this.getTrackingEndpoint(
        data.partnerCode,
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_TRACKING
      );

      this.logger.log(`Sending order to tracking API: ${endpoint.url}`);

      const body = this.buildOrderTrackingBody(data.order as BaseOrderReqDto);
      this.logger.log("Order info body sent to tracking", body);

      const response = await this.makeTrackingApiCall(endpoint.url, body);

      return this.createSuccessResponse<R>(
        response.data,
        "Order successfully pushed to tracking"
      );
    } catch (error) {
      this.logger.error(
        `Error pushing order to tracking: ${error.message}`,
        error.stack
      );
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to push order to tracking: ${error.message}`,
        error.response?.data || error
      );
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
      const endpoint = await this.getTrackingEndpoint(
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

      const response = await this.makeTrackingApiCall(endpoint.url, body);

      return this.createSuccessResponse<R>(
        response.data,
        "Order successfully manifested to tracking"
      );
    } catch (error) {
      this.logger.error(
        `Error manifesting order to tracking: ${error.message}`,
        error.stack
      );
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to manifest order to tracking: ${error.message}`,
        error.response?.data || error
      );
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
      const endpoint = await this.getTrackingEndpoint(
        data.partnerCode,
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_DRS
      );

      this.logger.log(`Sending order to DRS API: ${endpoint.url}`);

      const body = this.buildDrsPayload(data.order as BaseOrderReqDto);
      this.logger.log("DRS payload body sent to API", body);

      const response = await this.makeTrackingApiCall(endpoint.url, body);

      return this.createSuccessResponse<R>(
        response.data,
        "Order successfully pushed to DRS"
      );
    } catch (error) {
      this.logger.error(
        `Error pushing order to DRS: ${error.message}`,
        error.stack
      );
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to push order to DRS: ${error.message}`,
        error.response?.data || error
      );
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
}
