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

import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2, BaseUpdateOrderDtoV2, OrderDtov2 } from "src/common/dtos/base2.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { DiscordAlertService } from "../../infrastructure/alert/discord-alert.service";
import { PartnerServiceClient } from "src/common/services/partner-service.client";
import { TenantContext } from "src/common/interfaces/auth-provider.interface";

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
  order?: OrderDtov2;
  orders?: OrderDtov2[] | OrderDtov2; // Support both array and single object
  partnerCode: PARTNER_CODE_ENUM | string;
  eligiblePartners?: EligiblePartnersData;
}

export class StandardCancelRequestDtoV2 {
  order: BaseCancelOrderDtoV2;
  partnerCode: PARTNER_CODE_ENUM | string;
  eligiblePartners?: EligiblePartnersData;
}

export class StandardUpdateRequestDtoV2 {
  order: BaseUpdateOrderDtoV2;
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
    private readonly discordAlertService: DiscordAlertService,
    private readonly partnerServiceClient: PartnerServiceClient
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
    requestDto: StandardRequestDtoV2,
    tenantId?: string,
    userId?: string
  ): Promise<R> {
    // Normalize input: support both 'order' and 'orders' formats
    // 'orders' can be either an array or a single object
    let orderToProcess: OrderDtov2;
    
    if (requestDto.order) {
      // Single order format: { "order": { ... } }
      orderToProcess = requestDto.order;
    } else if (requestDto.orders) {
      // Check if orders is an array
      if (Array.isArray(requestDto.orders)) {
        // Multiple orders format: { "orders": [ { ... } ] }
        if (requestDto.orders.length > 0) {
          orderToProcess = requestDto.orders[0];
          this.logger.log(`Multiple orders format detected. Processing first order from array (${requestDto.orders.length} total orders)`);
        } else {
          throw new Error('"orders" array cannot be empty');
        }
      } else {
        // Single order as object format: { "orders": { ... } }
        orderToProcess = requestDto.orders as OrderDtov2;
        this.logger.log(`Single order format detected in "orders" field`);
      }
    } else {
      throw new Error('Either "order" or "orders" field must be provided');
    }

    // Build tenant context if tenant ID is provided (optional)
    let tenantContext: TenantContext | undefined;
    if (tenantId) {
      this.logger.debug(`Creating order V2 with tenant context: tenantId=${tenantId}, userId=${userId}`);
      
      // Fetch tenant-specific partner credentials if tenant ID is provided
      const partnerCode = requestDto.partnerCode as string;
      if (partnerCode && this.partnerServiceClient) {
        try {
          const credentials = await this.partnerServiceClient.getTenantPartnerCredentials(
            tenantId,
            partnerCode
          );
          
          if (credentials.length > 0) {
            this.logger.log(
              `Using tenant-specific credentials for tenant: ${tenantId}, partner: ${partnerCode}`
            );
            tenantContext = {
              tenantId,
              userId,
              partnerCredentials: credentials.map(c => ({ key: c.key, value: c.value })),
            };
          } else {
            this.logger.debug(
              `No tenant-specific credentials found for tenant: ${tenantId}, partner: ${partnerCode}. Will use default credentials.`
            );
            tenantContext = {
              tenantId,
              userId,
            };
          }
        } catch (error) {
          this.logger.debug(
            `Failed to fetch tenant credentials for tenant: ${tenantId}, partner: ${partnerCode}. Will use default credentials. Error: ${error.message}`
          );
          tenantContext = {
            tenantId,
            userId,
          };
        }
      } else {
        tenantContext = {
          tenantId,
          userId,
        };
      }
    }

    //this.logger.log(`Creating Order for ${orderToProcess.awbNumber || "unknown"}`);

    try {
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      const result = await partnerActivity.createOrderV2<BaseOrderReqDtoV2, R>(
        orderToProcess as BaseOrderReqDtoV2,
        requestDto.partnerCode as string,
        requestDto.eligiblePartners,
        tenantContext // Pass tenant context for tenant-specific credentials (optional)
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
          orderToProcess.awbNumber,
          requestDto.partnerCode as string,
          undefined,
          { eligiblePartners: requestDto.eligiblePartners, responseError: true }
        );
      }

      this.logger.log(
        `✅ Order creation completed successfully for ${orderToProcess.awbNumber}`
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
        orderToProcess.orderId,
        requestDto.partnerCode as string,
        undefined,
        { eligiblePartners: requestDto.eligiblePartners }
      );
      throw error;
    }
  }

  /**
   * Create an order V3 with tenant-specific credentials support
   * Accepts x-tenant-id and x-user-id from headers for tenant-specific credential lookup
   */
  async createOrderV3<R extends BaseOrderResDto>(
    requestDto: StandardRequestDtoV2,
    tenantId?: string,
    userId?: string
  ): Promise<R> {
    // Normalize input: support both 'order' and 'orders' formats
    let orderToProcess: OrderDtov2;
    
    if (requestDto.order) {
      orderToProcess = requestDto.order;
    } else if (requestDto.orders) {
      if (Array.isArray(requestDto.orders)) {
        if (requestDto.orders.length > 0) {
          orderToProcess = requestDto.orders[0];
          this.logger.log(`Multiple orders format detected. Processing first order from array (${requestDto.orders.length} total orders)`);
        } else {
          throw new Error('"orders" array cannot be empty');
        }
      } else {
        orderToProcess = requestDto.orders as OrderDtov2;
        this.logger.log(`Single order format detected in "orders" field`);
      }
    } else {
      throw new Error('Either "order" or "orders" field must be provided');
    }

    // Build tenant context if tenant ID is provided
    let tenantContext: TenantContext | undefined;
    if (tenantId) {
      this.logger.debug(`Creating order V3 with tenant context: tenantId=${tenantId}, userId=${userId}`);
      
      // Fetch tenant-specific partner credentials if tenant ID is provided
      const partnerCode = requestDto.partnerCode as string;
      if (partnerCode && this.partnerServiceClient) {
        try {
          const credentials = await this.partnerServiceClient.getTenantPartnerCredentials(
            tenantId,
            partnerCode
          );
          
          if (credentials.length > 0) {
            this.logger.log(
              `Using tenant-specific credentials for tenant: ${tenantId}, partner: ${partnerCode}`
            );
            tenantContext = {
              tenantId,
              userId,
              partnerCredentials: credentials.map(c => ({ key: c.key, value: c.value })),
            };
          } else {
            this.logger.debug(
              `No tenant-specific credentials found for tenant: ${tenantId}, partner: ${partnerCode}. Will use default credentials.`
            );
            tenantContext = {
              tenantId,
              userId,
            };
          }
        } catch (error) {
          this.logger.debug(
            `Failed to fetch tenant credentials for tenant: ${tenantId}, partner: ${partnerCode}. Will use default credentials. Error: ${error.message}`
          );
          tenantContext = {
            tenantId,
            userId,
          };
        }
      } else {
        tenantContext = {
          tenantId,
          userId,
        };
      }
    }

    try {
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      // Pass tenant context to createOrderV2
      const result = await partnerActivity.createOrderV2<BaseOrderReqDtoV2, R>(
        orderToProcess as BaseOrderReqDtoV2,
        requestDto.partnerCode as string,
        requestDto.eligiblePartners,
        tenantContext // Pass tenant context for tenant-specific credentials
      );

      if (
        result &&
        (result as any).statusCode &&
        (result as any).statusCode >= 400
      ) {
        this.logger.error(
          `🚨 ORDER CREATION RETURNED ERROR RESPONSE: ${JSON.stringify(result)}`
        );

        const errorForAlert = {
          message: (result as any).message || "Order creation failed",
          status: (result as any).statusCode,
          statusText: "API Error Response",
          stack: "No stack trace - API response error",
          response: result,
        };

        await this.discordAlertService.sendOrderCreationErrorAlert(
          errorForAlert,
          orderToProcess.awbNumber,
          requestDto.partnerCode as string,
          undefined,
          { eligiblePartners: requestDto.eligiblePartners, responseError: true, tenantId }
        );
      }

      this.logger.log(
        `✅ Order creation V3 completed successfully for ${orderToProcess.awbNumber}${tenantId ? ` (tenant: ${tenantId})` : ''}`
      );
      return result;
    } catch (error) {
      this.logger.error(`🚨 ORDER CREATION V3 ERROR CAUGHT: ${error.message}`);
      this.logger.error(`Error type: ${error.constructor.name}`);
      this.logger.error(`Error details: ${JSON.stringify(error)}`);

      await this.discordAlertService.sendOrderCreationErrorAlert(
        error,
        orderToProcess.orderId,
        requestDto.partnerCode as string,
        undefined,
        { eligiblePartners: requestDto.eligiblePartners, tenantId }
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
   * Cancel an order V2 with a network partner
   */
  async cancelOrderV2<R extends BaseResDto>(
    requestDto: StandardCancelRequestDtoV2
  ): Promise<R> {
    // Handle both "data" and "order" formats
    const orderData = requestDto.order || (requestDto as any).data;
    const awbDisplay = orderData?.cAwbNumbers?.join(",") || "unknown";
    this.logger.debug(`Cancelling Order V2 for ${awbDisplay}`);

    try {
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT,
        requestDto
      );

      const result = await partnerActivity.cancelOrderV2<BaseCancelOrderDtoV2, R>(
        orderData,  // Use the extracted order data
        requestDto.partnerCode as string,
        requestDto.eligiblePartners
      );

      if (
        result &&
        (result as any).statusCode &&
        (result as any).statusCode >= 400
      ) {
        this.logger.error(
          `🚨 ORDER CANCELLATION RETURNED ERROR RESPONSE: ${JSON.stringify(result)}`
        );

        const errorForAlert = {
          message: (result as any).message || "Order cancellation failed",
          status: (result as any).statusCode,
          statusText: "API Error Response",
          stack: "No stack trace - API response error",
          response: result,
        };

        await this.discordAlertService.sendOrderCancellationErrorAlert(
          errorForAlert,
          orderData?.cAwbNumbers,  // Use the extracted order data
          requestDto.partnerCode as string
        );
      }

      this.logger.log(
        `✅ Order cancellation completed successfully for ${awbDisplay}`
      );
      return result;
    } catch (error) {
      this.logger.error(`🚨 ORDER CANCELLATION ERROR CAUGHT: ${error.message}`);
      this.logger.error(`Error type: ${error.constructor.name}`);
      this.logger.error(`Error details: ${JSON.stringify(error)}`);

      await this.discordAlertService.sendOrderCancellationErrorAlert(
        error,
        orderData?.cAwbNumbers,  // Use the extracted order data
        requestDto.partnerCode as string
      );
      throw error;
    }
  }

  /**
   * Update an order V2 with a network partner
   */
  async updateOrderV2<R extends BaseResDto>(
    requestDto: StandardUpdateRequestDtoV2
  ): Promise<R> {
    const awbDisplay = requestDto.order.awbNumber || "unknown";
    this.logger.debug(`Updating Order V2 for ${awbDisplay}`);

    try {
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      const result = await partnerActivity.updateOrderV2<BaseUpdateOrderDtoV2, R>(
        requestDto.order,
        requestDto.partnerCode as string,
        requestDto.eligiblePartners
      );

      if (
        result &&
        (result as any).statusCode &&
        (result as any).statusCode >= 400
      ) {
        this.logger.error(
          `🚨 ORDER UPDATE RETURNED ERROR RESPONSE: ${JSON.stringify(result)}`
        );

        // Create a custom error object for Discord alerting
        const errorForAlert = {
          message: (result as any).message || "Order update failed",
          status: (result as any).statusCode,
          statusText: "API Error Response",
          stack: "No stack trace - API response error",
          response: result,
        };

        await this.discordAlertService.sendOrderDetailsErrorAlert(
          errorForAlert,
          requestDto.order.awbNumber,
          requestDto.partnerCode as string
        );
      }

      this.logger.log(
        `✅ Order update completed successfully for ${awbDisplay}`
      );
      return result;
    } catch (error) {
      this.logger.error(`🚨 ORDER UPDATE ERROR CAUGHT: ${error.message}`);
      this.logger.error(`Error type: ${error.constructor.name}`);
      this.logger.error(`Error details: ${JSON.stringify(error)}`);

      await this.discordAlertService.sendOrderDetailsErrorAlert(
        error,
        requestDto.order.awbNumber,
        requestDto.partnerCode as string
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
   * Push order to HubOps system V2 - Accepts the new standardized format
   * @param requestDto Request data containing order details
   * @returns Response from HubOps API
   */
  async pushOrderToHubOpsV2<R extends BaseResDto>(
    requestDto: StandardRequestDto
  ): Promise<R> {
    // Get the order to process
    const orderToProcess = requestDto.order;

    this.logger.log(
      `Pushing order to HubOps V2 for ${orderToProcess.awbNumber || "unknown"}`
    );

    try {
      const partnerActivity = this.networkPartnerFactory.getPartner(
        requestDto.partnerCode || PARTNER_CODE_ENUM.DEFAULT
      );

      const result = await partnerActivity.pushOrderToHubOpsV2<R>(
        requestDto
      );

      if (
        result &&
        (result as any).statusCode &&
        (result as any).statusCode >= 400
      ) {
        this.logger.error(
          `🚨 PUSH ORDER TO HUBOPS V2 RETURNED ERROR RESPONSE: ${JSON.stringify(result)}`
        );

        const errorForAlert = {
          message: (result as any).message || "Push order to HubOps V2 failed",
          status: (result as any).statusCode,
          statusText: "API Error Response",
          stack: "No stack trace - API response error",
          response: result,
        };

        await this.discordAlertService.sendPushOrderErrorAlert(
          errorForAlert,
          "PushOrderToHubOpsV2",
          orderToProcess.awbNumber,
          requestDto.partnerCode as string
        );
      }

      this.logger.log(
        `✅ Push order to HubOps V2 completed successfully for ${orderToProcess.awbNumber}`
      );
      return result;
    } catch (error) {
      this.logger.error(`🚨 PUSH ORDER TO HUBOPS V2 ERROR CAUGHT: ${error.message}`);
      this.logger.error(`Error type: ${error.constructor.name}`);
      this.logger.error(`Error details: ${JSON.stringify(error)}`);

      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "PushOrderToHubOpsV2",
        orderToProcess.awbNumber,
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
      return partnerActivity.updatePartnerToHubOps<
        UpdatePartnerToHubOpsRequestDto,
        R
      >(requestDto);
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

  /**
   * Create pickup request V2 with network partner
   * @param requestDto Request data containing pickup details
   * @param partnerCode Partner code for the network partner
   * @returns Response from pickup creation API
   */
  async createPickupV2<R extends BaseResDto>(
    requestDto: any,
    partnerCode: string = PARTNER_CODE_ENUM.DHL
  ): Promise<R> {
    this.logger.log(
      `Creating Pickup V2 for partner: ${partnerCode}`
    );

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(partnerCode);

      // Execute the operation with the selected partner
      return partnerActivity.createPickupV2<any, R>(
        requestDto,
        partnerCode
      );
    } catch (error) {
      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "CreatePickupV2",
        "pickup-request",
        partnerCode
      );
      throw error;
    }
  }

  /**
   * Cancel pickup request V2 with network partner
   * @param requestDto Request data containing pickup cancellation details
   * @param partnerCode Partner code for the network partner
   * @returns Response from pickup cancellation API
   */
  async cancelPickupV2<R extends BaseResDto>(
    requestDto: any,
    partnerCode: string = PARTNER_CODE_ENUM.DHL
  ): Promise<R> {
    this.logger.log(
      `Cancelling Pickup V2 for partner: ${partnerCode}`
    );

    try {
      // Get the appropriate partner implementation
      const partnerActivity = this.networkPartnerFactory.getPartner(partnerCode);

      // Execute the operation with the selected partner
      return partnerActivity.cancelPickupV2<any, R>(
        requestDto,
        partnerCode
      );
    } catch (error) {
      await this.discordAlertService.sendPushOrderErrorAlert(
        error,
        "CancelPickupV2",
        "pickup-cancellation",
        partnerCode
      );
      throw error;
    }
  }
}
