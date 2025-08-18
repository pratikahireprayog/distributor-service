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
  UpdatePartnerToHubOpsRequestDto,
} from "src/common/dtos/base.dto";

import { BaseOrderReqDtoV2, OrderDtov2 } from "src/common/dtos/base2.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { DiscordAlertService } from "../../infrastructure/alert/discord-alert.service";

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

export class StandardRequestDtoV2 {
  order: OrderDtov2;
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
    private readonly networkPartnerFactory: NetworkPartnerFactoryService,
    private readonly discordAlertService: DiscordAlertService
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

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner, passing eligiblePartners
      const result = await partnerActivity.createOrder<BaseOrderReqDto, R>(
        requestDto.order as BaseOrderReqDto,
        requestDto.partnerCode as string,
        requestDto.eligiblePartners
      );

      // Check if the result contains error data even with a successful response
      if (
        result &&
        (result as any).statusCode &&
        (result as any).statusCode >= 400
      ) {
        this.logger.error(
          `🚨 ORDER CREATION RETURNED ERROR RESPONSE: ${JSON.stringify(result)}`
        );

        // Create a custom error object for Discord alerting
        const errorForAlert = {
          message: (result as any).message || "Order creation failed",
          status: (result as any).statusCode,
          statusText: "API Error Response",
          stack: "No stack trace - API response error",
          response: result,
        };

        await this.discordAlertService.sendOrderCreationErrorAlert(
          errorForAlert,
          requestDto.order.awbNumber,
          requestDto.partnerCode as string,
          undefined,
          { eligiblePartners: requestDto.eligiblePartners, responseError: true }
        );
      }

      this.logger.log(
        `✅ Order creation completed successfully for ${requestDto.order.awbNumber}`
      );
      return result;
    } catch (error) {
      this.logger.error(`🚨 ORDER CREATION ERROR CAUGHT: ${error.message}`);
      this.logger.error(`Error type: ${error.constructor.name}`);
      this.logger.error(`Error details: ${JSON.stringify(error)}`);
      this.logger.error(
        `Is ApplicationFailure: ${error.constructor.name === "ApplicationFailure"}`
      );

      await this.discordAlertService.sendOrderCreationErrorAlert(
        error,
        requestDto.order.awbNumber,
        requestDto.partnerCode as string,
        undefined,
        { eligiblePartners: requestDto.eligiblePartners }
      );
      throw error;
    }
  }

  async createOrderV2<R extends BaseOrderResDto>(
    requestDto: StandardRequestDtoV2
  ): Promise<R> {
    //this.logger.log(`Creating Order for ${requestDto.order.awbNumber || "unknown"}`);

    try {
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      const result = await partnerActivity.createOrderV2<BaseOrderReqDtoV2, R>(
        requestDto.order as BaseOrderReqDtoV2,
        requestDto.partnerCode as string,
        requestDto.eligiblePartners
      );

      if (
        result &&
        (result as any).statusCode &&
        (result as any).statusCode >= 400
      ) {
        this.logger.error(
          `🚨 ORDER CREATION RETURNED ERROR RESPONSE: ${JSON.stringify(result)}`
        );

        // Create a custom error object for Discord alerting
        const errorForAlert = {
          message: (result as any).message || "Order creation failed",
          status: (result as any).statusCode,
          statusText: "API Error Response",
          stack: "No stack trace - API response error",
          response: result,
        };

        await this.discordAlertService.sendOrderCreationErrorAlert(
          errorForAlert,
          requestDto.order.awbNumber,
          requestDto.partnerCode as string,
          undefined,
          { eligiblePartners: requestDto.eligiblePartners, responseError: true }
        );
      }

      this.logger.log(
        `✅ Order creation completed successfully for ${requestDto.order.awbNumber}`
      );
      return result;
    } catch (error) {
      this.logger.error(`🚨 ORDER CREATION ERROR CAUGHT: ${error.message}`);
      this.logger.error(`Error type: ${error.constructor.name}`);
      this.logger.error(`Error details: ${JSON.stringify(error)}`);
      this.logger.error(
        `Is ApplicationFailure: ${error.constructor.name === "ApplicationFailure"}`
      );

      await this.discordAlertService.sendOrderCreationErrorAlert(
        error,
        requestDto.order.orderId,
        requestDto.partnerCode as string,
        undefined,
        { eligiblePartners: requestDto.eligiblePartners }
      );
      throw error;
    }
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

    try {
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
    } catch (error) {
      await this.discordAlertService.sendOrderCreationErrorAlert(
        error,
        requestDto.order.awbNumber,
        requestDto.partnerCode as string,
        undefined,
        { isRetry: true }
      );
      throw error;
    }
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

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        data.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner
      return partnerActivity.createManifest<T, R>(data);
    } catch (error) {
      await this.discordAlertService.sendManifestCreationErrorAlert(
        error,
        data.awbNumbers,
        data.partnerCode as string
      );
      throw error;
    }
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

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        params.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner
      return partnerActivity.getOrderDetails<T, R>(params);
    } catch (error) {
      await this.discordAlertService.sendOrderDetailsErrorAlert(
        error,
        params.awbNumber,
        params.partnerCode as string
      );
      throw error;
    }
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

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        data.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner
      return partnerActivity.cancelOrder<T, R>(data);
    } catch (error) {
      await this.discordAlertService.sendOrderCancellationErrorAlert(
        error,
        data.cAwbNumbers,
        data.partnerCode as string
      );
      throw error;
    }
  }

  /**
   * Push orders to DRS
   */
  async pushOrderToDRS<R extends BaseResDto>(
    data: StandardRequestDto
  ): Promise<R> {
    this.logger.log(
      `Creating DRS payload for ${data.order.awbNumber || "unknown"}`
    );

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        data.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner
      return partnerActivity.pushOrderToDRS<StandardRequestDto, R>(data);
    } catch (error) {
      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "PushOrderToDRS",
        data.order.awbNumber,
        data.partnerCode as string
      );
      throw error;
    }
  }

  /**
   * Push orders to PRS - Accepts the new standardized format
   */
  async pushOrdersToPRS<R extends BaseResDto>(
    requestDto: StandardRequestDto
  ): Promise<R> {
    this.logger.log(
      `Pushing orders to PRS: ${requestDto.order.awbNumber || "unknown"}`
    );

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner
      return partnerActivity.pushOrdersToPRS<StandardRequestDto, R>(requestDto);
    } catch (error) {
      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "PushOrdersToPRS",
        requestDto.order.awbNumber,
        requestDto.partnerCode as string,
        undefined,
        { awbCount: 1 }
      );
      throw error;
    }
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

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner
      return partnerActivity.pushOrderToTracking<StandardRequestDto, R>(
        requestDto
      );
    } catch (error) {
      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "PushOrderToTracking",
        requestDto.order.awbNumber,
        requestDto.partnerCode as string
      );
      throw error;
    }
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

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Get the type that the partner expects
      const orderData = requestDto.order as BaseOrderReqDto;

      // Execute the operation with the selected partner
      return partnerActivity.manifestOrderToTracking<StandardRequestDto, R>(
        requestDto
      );
    } catch (error) {
      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "ManifestOrderToTracking",
        requestDto.order.awbNumber,
        requestDto.partnerCode as string
      );
      throw error;
    }
  }

  /**
   * Update E-commerce order details with first mile hub
   * @param requestDto Request data containing order details and first mile hub info
   * @returns Response from ecom update API
   */
  async updateEcomOrderWebhook<R extends BaseResDto>(
    requestDto: StandardRequestDto
  ): Promise<R> {
    this.logger.log(
      `Updating ecom order details for ${requestDto.order.awbNumber || "unknown"}`
    );

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner
      return partnerActivity.updateEcomOrderWebhook<StandardRequestDto, R>(
        requestDto
      );
    } catch (error) {
      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "UpdateEcomOrderWebhook",
        requestDto.order.awbNumber,
        requestDto.partnerCode as string
      );
      throw error;
    }
  }

  /**
   * Push order to HubOps system - Accepts the new standardized format
   * @param requestDto Request data containing order details
   * @returns Response from HubOps API
   */
  async pushOrderToHubOps<R extends BaseResDto>(
    requestDto: StandardRequestDto
  ): Promise<R> {
    this.logger.log(
      `Pushing order to HubOps for ${requestDto.order.awbNumber || "unknown"}`
    );

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner
      return partnerActivity.pushOrderToHubOps<StandardRequestDto, R>(
        requestDto
      );
    } catch (error) {
      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "PushOrderToHubOps",
        requestDto.order.awbNumber,
        requestDto.partnerCode as string
      );
      throw error;
    }
  }

  /**
   * Update order in HubOps system - Accepts the new standardized format
   * @param requestDto Request data containing order details for update
   * @returns Response from HubOps API
   */
  async updateOrderToHubOps<R extends BaseResDto>(
    requestDto: StandardRequestDto
  ): Promise<R> {
    this.logger.log(
      `Updating order in HubOps for ${requestDto.order.awbNumber || "unknown"}`
    );

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(
      requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
    );

    // Execute the operation with the selected partner
    return partnerActivity.updateOrderToHubOps<StandardRequestDto, R>(
      requestDto
    );
  }

  /**
   * Update partner information to HubOps for multiple shipments
   * This method processes shipment details and updates partner info for each shipment
   * @param requestDto Request data containing shipmentDetails array
   * @returns Combined response for all shipment updates
   */
  async updatePartnerToHubOps<R extends BaseResDto>(
    requestDto: UpdatePartnerToHubOpsRequestDto
  ): Promise<R> {
    this.logger.log(
      `Updating partner information to HubOps for multiple shipments`
    );

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(
        PARTNER_CODE_ENUM.DEFAULT
      );

      // Execute the operation with the selected partner
      return partnerActivity.updatePartnerToHubOps<UpdatePartnerToHubOpsRequestDto, R>(requestDto);
    } catch (error) {
      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "UpdatePartnerToHubOps",
        "Multiple AWBs",
        "HUBOPS",
        undefined,
        {
          awbCount: requestDto?.shipmentDetails?.length || 0,
          operation: "Partner Update",
        }
      );
      throw error;
    }
  }
}
