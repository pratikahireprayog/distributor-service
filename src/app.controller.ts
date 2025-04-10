import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { AppService } from "./app.service";
import { DistributorService } from "./services/distributor/distributor.service";
import {
  BaseReqDto,
  BaseResDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseCancelOrderDto,
} from "./common/dtos/base.dto";
import { EligiblePartnersData } from "./common/dtos/global.dto";

// TODO: Move to dto
// DTO for create order endpoint
class CreateOrderDto {
  orderData: BaseOrderReqDto;
  eligiblePartners?: EligiblePartnersData;
}

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
    @Body() createOrderDto: CreateOrderDto
  ): Promise<BaseOrderResDto> {
    return this.distributorService.createOrder(
      createOrderDto.orderData,
      createOrderDto.eligiblePartners
    );
  }

  @Post("create-manifest")
  async createManifest(@Body() manifestData: BaseReqDto): Promise<BaseResDto> {
    return this.distributorService.createManifest(manifestData);
  }

  @Get("get-order-details")
  async getOrderDetails(@Query() params: BaseReqDto): Promise<BaseResDto> {
    return this.distributorService.getOrderDetails(params);
  }

  @Post("cancel-order")
  async cancelOrder(@Body() data: BaseCancelOrderDto): Promise<BaseResDto> {
    return this.distributorService.cancelOrder(data);
  }
}
