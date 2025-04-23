import { HttpService } from "@nestjs/axios";
import axios from "axios";
import { ConfigService } from "@nestjs/config";
import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from "@nestjs/common";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { BigshipAuthService } from "./bigship-auth.service";
import { BigshipEndPoints, FulfillmentEndPoints } from "./bigship.enum";
import { STATUS_TRACKING_STATUS_ENUM } from "src/common/enums/global.enum";
import {
  BaseReqDto,
  BaseResDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseCancelOrderDto,
} from "src/common/dtos/base.dto";
import {
  BigshipManifestReqDto,
  BigshipManifestResDto,
  ShipmentDataResDto,
} from "./bigship.dto";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
/**
 * Service for interacting with Bigship API
 */
@Injectable()
export class BigshipService extends BaseNetworkPartner {
  private readonly baseUrl: string;
  private readonly envUrl: string;
  /**
   * Constructor for BigshipService
   * @param authProvider The authentication provider
   * @param httpService The HTTP service
   * @param configService The configuration service
   */
  constructor(
    private readonly bigshipAuthService: BigshipAuthService,
    httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.BIGSHIP,
      bigshipAuthService,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
    this.baseUrl = this.configService.get<string>("BIGSHIP_BASE_URL");
    this.envUrl = this.configService.get<string>("ENV_URL");

    if (!this.baseUrl) {
      this.logger.error("BIGSHIP_BASE_URL environment variable is not set");
      throw new Error("BIGSHIP_BASE_URL environment variable is not set");
    }
  }

  private async getAuthToken(): Promise<string> {
    const token = await this.bigshipAuthService.getToken();
    if (!token) {
      throw new HttpException(
        "Failed to retrieve authentication token",
        HttpStatus.UNAUTHORIZED
      );
    }
    return token;
  }

  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    return await super.createOrder<T, R>(orderDetails, eligiblePartners);
  }

  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    return await super.getOrderDetails<T, R>(params);
  }

  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    return await super.cancelOrder<T, R>(data);
  }

  async createManifest<T extends BaseReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    // This will call the base class implementation which will use our concrete methods
    return await super.createManifest<T, R>(manifestationDetails);
  }
}
