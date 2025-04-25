import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { ShipyaariAuthService } from "./shipyaari-auth.service";
import { SHIPYAARI_ENV_VARS } from "./shipyaari.enum";

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

@Injectable()
export class ShipyaariService extends BaseNetworkPartner {
  protected readonly logger = new Logger(ShipyaariService.name);

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
  }

  /**
   * Create an order with Shipyaari
   * Delegates to BaseNetworkPartner for endpoint handling
   */
  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    return super.createOrder<T, R>(orderDetails, eligiblePartners);
  }

  /**
   * Create a manifest with Shipyaari
   * Delegates to BaseNetworkPartner for endpoint handling
   */
  async createManifest<T extends BaseReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    return super.createManifest<T, R>(manifestationDetails);
  }

  /**
   * Get order details from Shipyaari
   * Delegates to BaseNetworkPartner for endpoint handling
   */
  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    return super.getOrderDetails<T, R>(params);
  }

  /**
   * Cancel an order with Shipyaari
   * Delegates to BaseNetworkPartner for endpoint handling
   */
  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    return super.cancelOrder<T, R>(data);
  }

  /**
   * Override validation method if needed for Shipyaari-specific validation
   */
  protected validateInputForOperation(operation: string, data: any): boolean {
    // Add Shipyaari-specific validation if needed
    return super.validateInputForOperation(operation, data);
  }
}
