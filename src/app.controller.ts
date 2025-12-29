import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Put,
  Headers,
  Delete,
} from "@nestjs/common";
import { AppService } from "./app.service";
import {
  DistributorService,
  pushOrdersToPRSDto,
  StandardRequestDto,
  pushOrdersToPRSRequestDto,
  StandardRequestDtoV2,
  StandardCancelRequestDtoV2,
  StandardUpdateRequestDtoV2
} from "./services/distributor/distributor.service";
import {
  BaseReqDto,
  BaseResDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseCancelOrderDto,
  DRSPayloadDTO,
  ManifestReqDto,
  UpdatePartnerToHubOpsRequestDto,
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

  @Post("create-order-v2")
  async createOrderV2(
    @Body() requestDto: StandardRequestDtoV2,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-user-id') userId?: string
  ): Promise<any> {
    // Normalize partnerCode to canonical enum value, case-insensitive
    if (requestDto?.partnerCode) {
      const input = String(requestDto.partnerCode);
      const entries = Object.entries(PARTNER_CODE_ENUM);
      const keyMatch = entries.find(([key]) => key.toUpperCase() === input.toUpperCase());
      const valueMatch = entries.find(([, value]) => String(value).toUpperCase() === input.toUpperCase());
      if (keyMatch) {
        requestDto.partnerCode = keyMatch[1] as PARTNER_CODE_ENUM;
      } else if (valueMatch) {
        requestDto.partnerCode = valueMatch[1] as PARTNER_CODE_ENUM;
      }
    }
    return this.distributorService.createOrderV2(requestDto, tenantId, userId);
  }

  @Post("create-order-v3")
  async createOrderV3(
    @Body() requestDto: StandardRequestDtoV2,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-user-id') userId?: string
  ): Promise<any> {
    // Normalize partnerCode to canonical enum value, case-insensitive
    if (requestDto?.partnerCode) {
      const input = String(requestDto.partnerCode);
      const entries = Object.entries(PARTNER_CODE_ENUM);
      const keyMatch = entries.find(([key]) => key.toUpperCase() === input.toUpperCase());
      const valueMatch = entries.find(([, value]) => String(value).toUpperCase() === input.toUpperCase());
      if (keyMatch) {
        requestDto.partnerCode = keyMatch[1] as PARTNER_CODE_ENUM;
      } else if (valueMatch) {
        requestDto.partnerCode = valueMatch[1] as PARTNER_CODE_ENUM;
      }
    }
    return this.distributorService.createOrderV3(requestDto, tenantId, userId);
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

  @Post("cancel-order-v2")
  async cancelOrderV2(
    @Body() requestDto: StandardCancelRequestDtoV2
  ): Promise<BaseResDto> {
    return this.distributorService.cancelOrderV2(requestDto);
  }

  @Post("update-order-v2")
  async updateOrderV2(
    @Body() requestDto: StandardUpdateRequestDtoV2
  ): Promise<BaseResDto> {
    return this.distributorService.updateOrderV2(requestDto);
  }

  @Post("push-order-to-drs")
  async pushOrderToDRS(
    @Body() requestDto: StandardRequestDto
  ): Promise<BaseResDto> {
    return this.distributorService.pushOrderToDRS(requestDto);
  }

  @Post("push-orders-to-prs")
  async pushOrdersToPRS(
    @Body() requestDto: StandardRequestDto
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

  @Patch("update-ecom-order")
  async updateEcomOrderWebhook(
    @Body() requestDto: StandardRequestDto
  ): Promise<BaseResDto> {
    return this.distributorService.updateEcomOrderWebhook(requestDto);
  }

  @Post("push-order-to-hubops")
  async pushOrderToHubOps(
    @Body() requestDto: StandardRequestDto
  ): Promise<BaseResDto> {
    return this.distributorService.pushOrderToHubOps(requestDto);
  }

  @Post("update-order-to-hubops")
  async updateOrderToHubOps(
    @Body() requestDto: StandardRequestDto
  ): Promise<BaseResDto> {
    return this.distributorService.updateOrderToHubOps(requestDto);
  }

  @Post("create-pickup-v2")
  async createPickupV2(
    @Body() requestDto: any,
    @Query('partnerCode') partnerCode: string = 'DHL'
  ): Promise<BaseResDto> {
    return this.distributorService.createPickupV2(requestDto, partnerCode);
  }

  @Delete("cancel-pickup-v2")
  async cancelPickupV2(
    @Body() requestDto: any,
    @Query('partnerCode') partnerCode: string = 'DHL'
  ): Promise<BaseResDto> {
    return this.distributorService.cancelPickupV2(requestDto, partnerCode);
  }
  /**
   * Update partner information to HubOps for multiple shipments
   * Accepts an array of shipment details and updates partner info
   * for each shipment via HubOps API
   */
  @Post("update-partner-to-hubops")
  async updatePartnerToHubOps(
    @Body() responseData: UpdatePartnerToHubOpsRequestDto
  ): Promise<BaseResDto> {
    return this.distributorService.updatePartnerToHubOps(responseData);
  }
}
