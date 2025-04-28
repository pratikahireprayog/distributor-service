import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { AppService } from "./app.service";
import {
  DistributorService,
  pushOrdersToPRSDto,
  StandardRequestDto,
  pushOrdersToPRSRequestDto,
} from "./services/distributor/distributor.service";
import {
  BaseReqDto,
  BaseResDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseCancelOrderDto,
  DRSPayloadDTO,
  ManifestReqDto,
} from "./common/dtos/base.dto";
import { EligiblePartnersData } from "./common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "./common/enums/global.enum";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly distributorService: DistributorService
  ) {}

  @Get()
  getStatus(): string {
    return this.appService.getStatus();
  }

  @Get("ping")
  async healthCheck(): Promise<any> {
    return { statusCode: 200, message: "Distributor Service is running" };
  }

  @Post("create-order")
  async createOrder(
    @Body() requestDto: StandardRequestDto
  ): Promise<BaseOrderResDto> {
    return this.distributorService.createOrder(requestDto);
  }

  @Post("create-manifest")
  async createManifest(
    @Body() requestDto: ManifestReqDto
  ): Promise<BaseResDto> {
    return this.distributorService.createManifest(requestDto);
  }

  @Get("get-order-details")
  async getOrderDetails(
    @Query() requestDto: StandardRequestDto
  ): Promise<BaseResDto> {
    // Convert order field to BaseReqDto
    const params = requestDto.order as BaseReqDto;
    // Ensure partnerCode is transferred from request to params
    if (requestDto.partnerCode && !params.partnerCode) {
      params.partnerCode = requestDto.partnerCode as string;
    }
    return this.distributorService.getOrderDetails(params);
  }

  @Post("cancel-order")
  async cancelOrder(
    @Body() requestDto: BaseCancelOrderDto
  ): Promise<BaseResDto> {
    return this.distributorService.cancelOrder(requestDto);
  }

  @Post("create-drs")
  async createDRS(
    @Body() requestDto: StandardRequestDto
  ): Promise<DRSPayloadDTO> {
    return this.distributorService.createDRS(
      requestDto.order as BaseOrderReqDto,
      requestDto.partnerCode as string
    );
  }

  @Post("push-orders-to-prs")
  async pushOrdersToPRS(
    @Body() requestDto: pushOrdersToPRSDto
  ): Promise<BaseResDto> {
    return this.distributorService.pushOrdersToPRS(requestDto);
  }

  @Post("push-order-to-tracking")
  async pushOrderToTracking(
    @Body() requestDto: StandardRequestDto
  ): Promise<BaseResDto> {
    return this.distributorService.pushOrderToTracking(requestDto);
  }

  @Post("manifest-order-to-tracking")
  async manifestOrderToTracking(
    @Body() requestDto: StandardRequestDto
  ): Promise<BaseResDto> {
    return this.distributorService.manifestOrderToTracking(requestDto);
  }
}
