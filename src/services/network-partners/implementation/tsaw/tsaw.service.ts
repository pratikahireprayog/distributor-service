import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { TsawAuthService } from "./tsaw-auth.service";
import {
  BaseCancelOrderDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
} from "src/common/dtos/base.dto";

@Injectable()
export class TsawService extends BaseNetworkPartner {
  constructor(
    private readonly tsawAuthService: TsawAuthService,
    httpService: HttpService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.TSAW,
      tsawAuthService,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T
  ): Promise<R> {
    return await super.createOrder<T, R>(orderDetails);
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
}
