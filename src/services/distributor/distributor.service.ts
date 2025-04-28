import { Injectable, Logger } from "@nestjs/common";
import { NetworkPartnerFactoryService } from "src/services/network-partners/factory/network-partner-factory.service";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import {
  BaseCancelOrderDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
  DRSPayloadDTO,
  ManifestReqDto,
  OrderDto,
} from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";

/**
 * DTO for pushing orders to PRS
 */
export class pushOrdersToPRSDto {
  awbNumbers: string[];
  partnerCode?: PARTNER_CODE_ENUM;
}

/**
 * Standardized request DTO for all endpoints
 */
export class StandardRequestDto {
  order: OrderDto;
  partnerCode: PARTNER_CODE_ENUM | string;
  eligiblePartners?: EligiblePartnersData;
}

/**
 * Specific DTO for the push-orders-to-prs endpoint
 */
export class pushOrdersToPRSRequestDto {
  order: pushOrdersToPRSDto;
  partnerCode: PARTNER_CODE_ENUM | string;
}

/**
 * Service for distributing operations to network partners
 * Acts as a facade that routes operations to network partners
 */
@Injectable()
export class DistributorService {
  private readonly logger = new Logger(DistributorService.name);

  constructor(
    private readonly networkPartnerFactory: NetworkPartnerFactoryService
  ) {}

  /**
   * Main method to create an order with a network partner
   */
  async createOrder<R extends BaseOrderResDto>(
    requestDto: StandardRequestDto
  ): Promise<R> {
    this.logger.log(
      `Creating Order for ${requestDto.order.awbNumber || "unknown"}`
    );

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(
      requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
    );

    // Execute the operation with the selected partner, passing eligiblePartners
    return partnerActivity.createOrder<BaseOrderReqDto, R>(
      requestDto.order as BaseOrderReqDto,
      requestDto.partnerCode as string,
      requestDto.eligiblePartners
    );
  }

  /**
   * Retry creating an order with the next available partner
   */
  async retryCreateOrder<R extends BaseOrderResDto>(
    requestDto: StandardRequestDto
  ): Promise<R> {
    this.logger.log(
      `Retrying order creation for ${requestDto.order.awbNumber || "unknown"}`
    );

    // Get the default partner
    const partnerActivity = this.networkPartnerFactory.getPartner(
      PARTNER_CODE_ENUM.DEFAULT
    );

    // Execute the operation with the default partner
    // This will use the partner helper to determine the next partner to try
    return partnerActivity.createOrder<BaseOrderReqDto, R>(
      requestDto.order as BaseOrderReqDto,
      requestDto.partnerCode as string
    );
  }

  /**
   * Create a manifest with a network partner
   */
  async createManifest<
    T extends ManifestReqDto = ManifestReqDto,
    R extends BaseResDto = BaseResDto,
  >(data: T): Promise<R> {
    this.logger.log(
      `Creating Manifestation for ${data.awbNumbers.join(",") || "unknown"}`
    );

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(
      data.partnerCode || PARTNER_CODE_ENUM.DEFAULT
    );

    // Execute the operation with the selected partner
    return partnerActivity.createManifest<T, R>(data);
  }

  /**
   * Get order details from a network partner
   */
  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    this.logger.debug(
      `Getting Order Details for ${params.awbNumber || "unknown"}`
    );

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(
      params.partnerCode || PARTNER_CODE_ENUM.DEFAULT
    );

    // Execute the operation with the selected partner
    return partnerActivity.getOrderDetails<T, R>(params);
  }

  /**
   * Cancel an order with a network partner
   */
  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    const awbDisplay = data.cAwbNumbers?.length
      ? data.cAwbNumbers.join(",")
      : "unknown";
    this.logger.debug(`Cancelling Order for ${awbDisplay}`);

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(
      data.partnerCode || PARTNER_CODE_ENUM.DEFAULT
    );

    // Execute the operation with the selected partner
    return partnerActivity.cancelOrder<T, R>(data);
  }

  /**
   * Create DRS payload for an order
   */
  async createDRS<R extends DRSPayloadDTO>(
    orderData: BaseOrderReqDto,
    partnerCode: string
  ): Promise<R> {
    this.logger.log(
      `Creating DRS payload for ${orderData.awbNumber || "unknown"}`
    );

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(
      orderData.partnerCode || PARTNER_CODE_ENUM.DEFAULT
    );

    // Execute the operation with the selected partner
    return partnerActivity.createDRS<BaseOrderReqDto, R>(
      orderData,
      partnerCode
    );
  }

  /**
   * Push orders to PRS - Accepts the new standardized format
   */
  async pushOrdersToPRS<R extends BaseResDto>(
    requestDto: pushOrdersToPRSDto
  ): Promise<R> {
    this.logger.log(
      `Pushing orders to PRS: ${requestDto.awbNumbers || "unknown"}`
    );

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(
      requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
    );

    // Execute the operation with the selected partner
    return partnerActivity.pushOrdersToPRS<pushOrdersToPRSDto, R>(requestDto);
  }

  /**
   * Push order to tracking system - Accepts the new standardized format
   */
  async pushOrderToTracking<R extends BaseResDto>(
    requestDto: StandardRequestDto
  ): Promise<R> {
    this.logger.log(
      `Pushing order to tracking for ${requestDto.order.awbNumber || "unknown"}`
    );

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(
      requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
    );

    // Execute the operation with the selected partner
    return partnerActivity.pushOrderToTracking<StandardRequestDto, R>(
      requestDto
    );
  }

  /**
   * Manifest order to tracking system - Accepts the new standardized format
   */
  async manifestOrderToTracking<R extends BaseResDto>(
    requestDto: StandardRequestDto
  ): Promise<R> {
    this.logger.log(
      `Manifesting order to tracking for ${requestDto.order.awbNumber || "unknown"}`
    );

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(
      requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
    );

    // Get the type that the partner expects
    const orderData = requestDto.order as BaseOrderReqDto;

    // Execute the operation with the selected partner
    return partnerActivity.manifestOrderToTracking<BaseOrderReqDto, R>(
      orderData
    );
  }
}
