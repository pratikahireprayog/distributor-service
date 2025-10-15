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
  IndiaPostDomesticBulkBookingReqDto,
  IndiaPostDomesticBulkBookingResDto,
  IndiaPostDomesticBulkBookingErrorResDto,
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
   * Now uses the Bulk Booking API
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends any>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.log(
      `Creating India Post Domestic order V2 for AWB: ${orderDetails.awbNumber}`
    );

    try {
      // Get customer ID and contract ID from environment or config
      const customerId =
        this.configService.get<string>("INDIA_POST_DOMESTIC_CUSTOMER_ID") ||
        "1000000444";
      const contractId =
        this.configService.get<string>("INDIA_POST_DOMESTIC_CONTRACT_ID") ||
        "41441234";

      // Transform order to India Post format
      const bulkBookingRequest = this.transformOrderToIndiaPostArticle(
        orderDetails,
        customerId,
        contractId
      );

      // Call bulk booking API
      const result = await this.bulkBookingJSON(customerId, bulkBookingRequest);

      this.logger.log(
        `India Post Domestic order created successfully. Batch ID: ${result.batch_id}`
      );

      // Transform response to match expected BaseOrderResDto format
      const response = {
        statusCode: 200,
        message: "Order created successfully with India Post Domestic",
        partnerCode: PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
        data: {
          originalResponse: result,
          trackingId:
            result.valid_articles[0]?.barcode_no || orderDetails.awbNumber,
          referenceNumber: result.batch_id,
          requestUrl: `${this.getBaseUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.BULK_BOOKING_JSON}/${customerId}`,
          requestBody: bulkBookingRequest,
          // India Post specific fields
          batchId: result.batch_id,
          correlationId: result.correlation_id,
          tariff: result.summary.total_tariff_amount,
          currency: result.valid_articles[0]?.currency || "INR",
          validArticles: result.valid_articles,
          errorArticles: result.error_articles,
          summary: result.summary,
        },
        trace: {
          timestamp: new Date().toISOString(),
          partnerCode: PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
        },
      };

      return response as R;
    } catch (error) {
      this.logger.error(
        "India Post Domestic order creation V2 failed:",
        error.message
      );
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `India Post Domestic order creation V2 failed: ${error.message}`
      );
    }
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
  // BULK BOOKING API IMPLEMENTATIONS
  // ================================

  /**
   * Bulk Booking API - JSON Endpoint
   * Processes up to 1000 articles in a single request
   * Based on API Documentation Section 14.4
   */
  async bulkBookingJSON(
    customId: string,
    bookingRequest: IndiaPostDomesticBulkBookingReqDto
  ): Promise<IndiaPostDomesticBulkBookingResDto> {
    try {
      this.logger.log(
        `Processing bulk booking (JSON) for customId: ${customId} with ${bookingRequest.articles.length} articles`
      );

      // Validate article count
      if (bookingRequest.articles.length === 0) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "Empty articles array provided"
        );
      }

      if (bookingRequest.articles.length > 1000) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "Batch size exceed the max size of payload 1000 items for JSON endpoint"
        );
      }

      // Get authentication headers
      const authHeaders = await this.authProvider.getAuthHeaders();
      const url = `${this.getBaseUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.BULK_BOOKING_JSON}/${customId}`;

      this.logger.debug(`Making bulk booking request to: ${url}`);

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticBulkBookingResDto>(
          url,
          bookingRequest,
          {
            headers: {
              ...authHeaders,
              "Content-Type": "application/json",
            },
            timeout: INDIA_POST_DOMESTIC_CONFIG.HTTP_TIMEOUT_MS,
          }
        )
      );

      this.logger.log(
        `Bulk booking completed for customId: ${customId}. Success: ${response.data.summary.success_count}, Errors: ${response.data.summary.error_count}`
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Bulk booking (JSON) failed for customId: ${customId}:`,
        error.message
      );

      if (error.response) {
        this.logger.error("Response status:", error.response.status);
        this.logger.error(
          "Response data:",
          error.response.data ? "Data present" : "No response data"
        );

        // Log the actual validation errors from India Post API
        if (error.response.data) {
          try {
            const errorData = error.response.data;
            this.logger.error(
              "🔍 India Post API Error Details:",
              JSON.stringify(errorData, null, 2)
            );

            if (errorData.errors && Array.isArray(errorData.errors)) {
              this.logger.error("📋 Validation Errors:");
              errorData.errors.forEach((err, index) => {
                this.logger.error(
                  `  ${index + 1}. ${err.msg || err.message} (Field: ${err.path || err.field})`
                );
              });
            }
          } catch (jsonError) {
            this.logger.error("Could not parse error response as JSON");
          }
        }

        if (error.response.status === 400) {
          // Return the error response as received from API
          throw new CustomHttpException(
            HttpStatus.BAD_REQUEST,
            `India Post Domestic bulk booking validation failed: ${
              error.response.data?.message || error.message
            }`
          );
        }
      }

      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `India Post Domestic bulk booking failed: ${error.message}`
      );
    }
  }

  /**
   * Bulk Booking API - File Upload Endpoint
   * Processes up to 5000 articles via file upload
   * Based on API Documentation Section 14.4
   */
  async bulkBookingFile(
    customId: string,
    fileBuffer: Buffer,
    filename: string = "articles.json"
  ): Promise<IndiaPostDomesticBulkBookingResDto> {
    try {
      this.logger.log(
        `Processing bulk booking (File) for customId: ${customId} with file: ${filename}`
      );

      // Get authentication headers
      const authHeaders = await this.authProvider.getAuthHeaders();
      const url = `${this.getBaseUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.BULK_BOOKING_FILE}/${customId}`;

      this.logger.debug(`Making bulk booking file request to: ${url}`);

      // Create form data
      const FormData = require("form-data");
      const formData = new FormData();
      formData.append("file", fileBuffer, {
        filename: filename,
        contentType: "application/json",
      });

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticBulkBookingResDto>(
          url,
          formData,
          {
            headers: {
              ...authHeaders,
              ...formData.getHeaders(),
            },
            timeout: INDIA_POST_DOMESTIC_CONFIG.HTTP_TIMEOUT_MS,
          }
        )
      );

      this.logger.log(
        `Bulk booking (File) completed for customId: ${customId}. Success: ${response.data.summary.success_count}, Errors: ${response.data.summary.error_count}`
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Bulk booking (File) failed for customId: ${customId}:`,
        error.message
      );

      if (error.response) {
        this.logger.error("Response status:", error.response.status);
        this.logger.error(
          "Response data:",
          error.response.data ? "Data present" : "No response data"
        );

        if (error.response.status === 400) {
          throw new CustomHttpException(
            HttpStatus.BAD_REQUEST,
            `India Post Domestic bulk booking file validation failed: ${
              error.response.data?.message || error.message
            }`
          );
        }
      }

      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `India Post Domestic bulk booking file upload failed: ${error.message}`
      );
    }
  }

  /**
   * Helper method to convert your order data to India Post Domestic article format
   * This method helps transform your existing order structure to India Post format
   */
  transformOrderToIndiaPostArticle(
    orderData: BaseOrderReqDtoV2,
    customerId: string,
    contractId: string
  ): IndiaPostDomesticBulkBookingReqDto {
    try {
      this.logger.debug(
        `Transforming order ${orderData.awbNumber} to India Post format`
      );

      // Get pickup and delivery addresses
      const pickupAddress = orderData.addresses?.find(
        (addr) => addr.type === "pickup"
      );
      const deliveryAddress = orderData.addresses?.find(
        (addr) => addr.type === "delivery"
      );

      if (!pickupAddress || !deliveryAddress) {
        throw new Error("Both pickup and delivery addresses are required");
      }

      // Transform to India Post article format - ALL REQUIRED FIELDS INCLUDED
      const article = {
        // Basic Information (MANDATORY)
        bulk_customer_id: customerId,
        contract_id: contractId,
        barcode_no: orderData.awbNumber,
        pickup_or_dropoff: "DROPOFF", // MANDATORY: "PICKUP" or "DROPOFF"
        article_type: "SP" as const, // MANDATORY: "SP" or "BP"

        // Physical Properties (MANDATORY)
        physical_weight: Math.round(
          orderData.parentShipment?.physicalWeight || 100
        ), // Must be whole number
        shape_of_article: "DOC" as const, // MANDATORY: "ROLL", "NROL", "DOC"
        length: orderData.parentShipment?.dimensions?.length || 10, // MANDATORY
        breadth_diameter: orderData.parentShipment?.dimensions?.width || 10, // MANDATORY
        height: orderData.parentShipment?.dimensions?.height || 5, // MANDATORY

        // Optional delivery settings (omit if not specified)
        priority_flag: false,
        // delivery_instruction: undefined, // Omit optional enum fields if empty
        // delivery_slot: undefined, // Omit optional enum fields if empty
        // instruction_rts: undefined, // Omit optional enum fields if empty

        // Sender Information (MANDATORY FIELDS)
        sender_name: pickupAddress.name || "Sender Name",
        sender_company: pickupAddress.name || "Sender Company",
        sender_add_line_1: pickupAddress.street || "Sender Address",
        sender_add_line_2: pickupAddress.landmark || "",
        sender_city: pickupAddress.city || "Bangalore",
        sender_state: pickupAddress.state || "Karnataka",
        sender_pincode: pickupAddress.zip || "560001",
        sender_emailid: "",
        sender_alt_contact: "",
        sender_kyc: "",
        sender_tax_reference: "",
        sender_mobile_no: pickupAddress.phone || "9999999999",

        // Receiver Information (MANDATORY FIELDS)
        receiver_name: deliveryAddress.name || "Receiver Name",
        receiver_company: deliveryAddress.name || "Receiver Company",
        receiver_add_line_1: deliveryAddress.street || "Receiver Address",
        receiver_add_line_2: deliveryAddress.landmark || "",
        receiver_city: deliveryAddress.city || "Delhi",
        receiver_state: deliveryAddress.state || "Delhi",
        receiver_pincode: deliveryAddress.zip || "110001",
        receiver_emailid: "",
        receiver_alt_contact: "",
        receiver_kyc: "",
        receiver_tax_reference: "",
        receiver_mobile_no: deliveryAddress.phone || "9999999999",

        // Address Flags (MANDATORY)
        alt_address_flag: false,
        pickup_address_flag: false,
        drop_off_pincode: pickupAddress.zip || "560001",

        // Payment Information (MANDATORY)
        // prepayment_code: undefined, // Optional enum: "PS" | "FM" | "SS"
        value_of_prepayment: 0,
        codr_cod: "COD" as const, // MANDATORY: "COD" or "CODR"
        value_for_codr_cod: orderData.payment?.finalAmount || 0, // MANDATORY
        // insurance_type: undefined, // Optional enum: "DOP"
        value_of_insurance: 0,
        ack: false,
        bulk_reference: orderData.awbNumber, // MANDATORY

        // Pickup Address (MANDATORY FIELDS)
        // pickup_address_id: undefined, // Optional number field
        pickup_addressee_name: pickupAddress.name || "Pickup Person", // MANDATORY
        pickup_company_name: pickupAddress.name || "Pickup Company", // MANDATORY
        pickup_address_line1: pickupAddress.street || "Pickup Address", // MANDATORY
        pickup_address_line2: pickupAddress.landmark || "",
        pickup_address_line3: "",
        pickup_city: pickupAddress.city || "Bangalore", // MANDATORY
        pickup_state: pickupAddress.state || "Karnataka",
        pickup_pincode: pickupAddress.zip || "560001", // MANDATORY
        pickup_email_id: "",
        pickup_alt_contact_no: "",
        pickup_mobile_no: pickupAddress.phone || "9999999999", // MANDATORY
        pickup_schedule_slot: "",
        pickup_schedule_date: "",

        // Alternative Address (MANDATORY FIELDS)
        alt_addressee_name: deliveryAddress.name || "Alt Person", // MANDATORY
        alt_company_name: deliveryAddress.name || "Alt Company", // MANDATORY
        alt_address_line1: deliveryAddress.street || "Alt Address", // MANDATORY
        alt_address_line2: deliveryAddress.landmark || "",
        alt_address_line3: "",
        alt_city: deliveryAddress.city || "Delhi", // MANDATORY
        alt_state: deliveryAddress.state || "Delhi",
        alt_pincode: deliveryAddress.zip || "110001", // MANDATORY
        alt_email_id: "",
        alt_contact_no: "",
        alt_alternate_mobile_no: deliveryAddress.phone || "9999999999", // MANDATORY
      };

      this.logger.debug(
        `📦 Transformed article for India Post:`,
        JSON.stringify(article, null, 2)
      );

      return {
        articles: [article],
      };
    } catch (error) {
      this.logger.error(
        `Failed to transform order to India Post format:`,
        error.message
      );
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Order transformation failed: ${error.message}`
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
