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
import { PushOrdersToPrsDto } from "src/services/distributor/distributor.service";
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
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${orderDetails.partnerCode}`
    );
    // Set the partner code from the request data
    (this as any).partnerCode = orderDetails.partnerCode;
    return await super.createOrder<T, R>(orderDetails, eligiblePartners);
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

  async pushOrdersToPrs<T extends PushOrdersToPrsDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Using base implementation for partner code: ${data.partnerCode}`
    );
    // Set the partner code from the request data
    (this as any).partnerCode = data.partnerCode;
    return await super.pushOrdersToPrs<T, R>(data);
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
      smileAwbNumber:
        "smileAwbNumber" in data ? data.smileAwbNumber : undefined,
      type: "ECOMM",
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
      deliveryPartnerName: data.partnerCode?.toLowerCase() || "innofulfill",
      event: "ready_for_dispatch",
      location: data.pickupAddress
        ? `${data.pickupAddress.address1}, ${data.pickupAddress.address2 || ""}, ${data.pickupAddress.zip}, ${data.pickupAddress.city}, ${data.pickupAddress.state}, ${data.pickupAddress.country}`
        : "",
      trackingId: data.awbNumber,
      cAwbNumber: data.cAwbNumber,
    };
  }

  async pushOrderToTracking<T extends BaseOrderReqDto, R extends BaseResDto>(
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

      const body = this.buildOrderTrackingBody(data);
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
    T extends BaseOrderReqDto,
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

      const body = this.buildManifestTrackingBody(data);
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
}
