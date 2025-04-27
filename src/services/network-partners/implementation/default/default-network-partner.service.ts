import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
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
}
