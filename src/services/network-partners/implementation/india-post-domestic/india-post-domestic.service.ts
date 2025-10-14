import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { IndiaPostDomesticAuthService } from "./india-post-domestic-auth.service";
import {
  INDIA_POST_DOMESTIC_BASE_URLS,
  INDIA_POST_DOMESTIC_ENDPOINTS,
  INDIA_POST_DOMESTIC_ENV_VARS,
  INDIA_POST_DOMESTIC_CONFIG,
} from "./india-post-domestic.enum";

import {
  BaseOrderResDto,
  BaseOrderReqDto,
  BaseReqDto,
  BaseResDto,
  BaseCancelOrderDto,
  ManifestReqDto,
} from "src/common/dtos/base.dto";
import { BaseOrderReqDtoV2 } from "src/common/dtos/base2.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import {
  ENDPOINT_ID_ENUM,
  PARTNER_CODE_ENUM,
} from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { CustomHttpException } from "src/infrastructure/exception-handlers";

import {
  IndiaPostDomesticCreateOrderReqDto,
  IndiaPostDomesticCreateOrderResDto,
  IndiaPostDomesticTrackingReqDto,
  IndiaPostDomesticTrackingResDto,
  IndiaPostDomesticPincodeSearchReqDto,
  IndiaPostDomesticPincodeSearchResDto,
  IndiaPostDomesticTariffReqDto,
  IndiaPostDomesticTariffResDto,
  IndiaPostDomesticManifestReqDto,
  IndiaPostDomesticManifestResDto,
  IndiaPostDomesticCancelOrderReqDto,
  IndiaPostDomesticCancelOrderResDto,
} from "./india-post-domestic.dto";

/**
 * India Post Domestic Service Implementation
 * Implements all required network partner operations for India Post domestic services
 *
 * Current Implementation Status:
 * ✅ Authentication (Access Token + Refresh Token)
 * 🚧 Order Creation (To be implemented)
 * 🚧 Order Tracking (To be implemented)
 * 🚧 Pincode Search (To be implemented)
 * 🚧 Tariff Calculation (To be implemented)
 * 🚧 Manifest Creation (To be implemented)
 * 🚧 Order Cancellation (To be implemented)
 */
@Injectable()
export class IndiaPostDomesticService extends BaseNetworkPartner {
  protected readonly logger = new Logger(IndiaPostDomesticService.name);

  constructor(
    protected readonly authProvider: IndiaPostDomesticAuthService,
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
      authProvider,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  // ================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // ================================

  /**
   * Create order with India Post Domestic (V1)
   * Currently returns placeholder response - will be implemented after API documentation
   */
  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.log(
      `Creating India Post Domestic order for AWB: ${orderDetails.awbNumber}`
    );

    // TODO: Implement actual order creation logic after receiving API documentation
    throw new CustomHttpException(
      HttpStatus.NOT_IMPLEMENTED,
      "India Post Domestic order creation not yet implemented. Please provide API documentation to complete implementation."
    );
  }

  /**
   * Create order with India Post Domestic (V2)
   * Currently returns placeholder response - will be implemented after API documentation
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends any>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.log(
      `Creating India Post Domestic order V2 for AWB: ${orderDetails.awbNumber}`
    );

    // Test authentication to verify token APIs are working (this won't affect the main flow)
    this.logger.log("🧪 Testing India Post Domestic authentication...");
    try {
      await this.authProvider.getAuthHeaders();
      this.logger.log(
        "✅ Authentication test passed - Token APIs are working!"
      );
    } catch (authError) {
      this.logger.error("❌ Authentication test failed:", authError.message);
      // Don't throw here, just log the failure and continue with the not-implemented error
    }

    // TODO: Implement actual order creation V2 logic after receiving API documentation
    throw new CustomHttpException(
      HttpStatus.NOT_IMPLEMENTED,
      "India Post Domestic order creation V2 not yet implemented. Please provide API documentation to complete implementation."
    );
  }

  /**
   * Get order details (tracking)
   * Currently returns placeholder response - will be implemented after API documentation
   */
  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    this.logger.log(
      `Getting India Post Domestic order details for: ${JSON.stringify(params)}`
    );

    // TODO: Implement actual tracking logic after receiving API documentation
    throw new CustomHttpException(
      HttpStatus.NOT_IMPLEMENTED,
      "India Post Domestic order tracking not yet implemented. Please provide API documentation to complete implementation."
    );
  }

  /**
   * Cancel order
   * Currently returns placeholder response - will be implemented after API documentation
   */
  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    this.logger.log(
      `Cancelling India Post Domestic orders: ${params.cAwbNumbers.join(", ")}`
    );

    // TODO: Implement actual cancellation logic after receiving API documentation
    throw new CustomHttpException(
      HttpStatus.NOT_IMPLEMENTED,
      "India Post Domestic order cancellation not yet implemented. Please provide API documentation to complete implementation."
    );
  }

  /**
   * Create manifest
   * Currently returns placeholder response - will be implemented after API documentation
   */
  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    this.logger.log(
      `Creating India Post Domestic manifest for ${params.awbNumbers?.length || 0} orders`
    );

    // TODO: Implement actual manifest creation logic after receiving API documentation
    throw new CustomHttpException(
      HttpStatus.NOT_IMPLEMENTED,
      "India Post Domestic manifest creation not yet implemented. Please provide API documentation to complete implementation."
    );
  }

  // ================================
  // AUTHENTICATION TESTING METHODS
  // ================================

  /**
   * Test authentication - Available immediately for testing token flow
   */
  async testAuthentication(): Promise<{
    success: boolean;
    tokenInfo?: any;
    error?: string;
  }> {
    try {
      this.logger.log("Testing India Post Domestic authentication...");
      return await this.authProvider.testAuthentication();
    } catch (error) {
      this.logger.error("Authentication test failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current token information - Available immediately for debugging
   */
  async getTokenInfo(): Promise<any> {
    try {
      const tokenInfo = (
        this.authProvider as IndiaPostDomesticAuthService
      ).getTokenInfo();
      this.logger.debug("Token info retrieved:", tokenInfo);
      return {
        success: true,
        tokenInfo: tokenInfo,
      };
    } catch (error) {
      this.logger.error("Failed to get token info:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear cached tokens - Available immediately for testing
   */
  async clearTokens(): Promise<{ success: boolean; message: string }> {
    try {
      (this.authProvider as IndiaPostDomesticAuthService).clearTokens();
      this.logger.log("Tokens cleared successfully");
      return { success: true, message: "Tokens cleared successfully" };
    } catch (error) {
      this.logger.error("Failed to clear tokens:", error.message);
      return { success: false, message: error.message };
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  /**
   * Get base URL for API calls
   */
  private getBaseUrl(): string {
    return (
      this.configService.get<string>(INDIA_POST_DOMESTIC_ENV_VARS.BASE_URL) ||
      INDIA_POST_DOMESTIC_BASE_URLS.TEST
    );
  }

  /**
   * Make authenticated API call - utility method for future implementations
   */
  private async makeAuthenticatedRequest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    data?: any
  ): Promise<T> {
    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.getBaseUrl()}${endpoint}`;

      this.logger.debug(`Making ${method} request to: ${url}`);

      const response = await firstValueFrom(
        this.httpService.request<T>({
          method,
          url,
          data,
          headers,
          timeout: INDIA_POST_DOMESTIC_CONFIG.HTTP_TIMEOUT_MS,
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`API request failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `India Post Domestic API request failed: ${error.message}`
      );
    }
  }

  // ================================
  // FUTURE API IMPLEMENTATIONS
  // ================================

  // These methods will be implemented as we add more APIs:
  // - searchPincode()
  // - calculateTariff()
  // - generateLabel()
  // - trackMultipleOrders()
  // - getServiceAvailability()
  // - etc.
}
