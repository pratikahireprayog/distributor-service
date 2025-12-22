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
  IndiaPostDomesticArticleDto,
} from "./india-post-domestic.dto";
import { generateIndiaPostDomesticAWB } from "./india-post-domestic-awb-generator";

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

      // Generate AWB number for India Post Domestic
      // The orderDetails.awbNumber is the user's AWB (internal tracking)
      // We generate a new AWB that will be sent to India Post
      const generatedAWB = generateIndiaPostDomesticAWB();
      this.logger.log(
        `Generated India Post Domestic AWB: ${generatedAWB} for user AWB: ${orderDetails.awbNumber}`
      );

      // Ensure parentShipment exists and update with generated AWB
      if (!orderDetails.parentShipment) {
        orderDetails.parentShipment = {} as any;
      }
      orderDetails.parentShipment.awbNumber = generatedAWB;

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

      // Check if there are any error articles in the response
      // If all articles failed, return error response following UrbanBolt pattern
      if (
        result.error_articles &&
        result.error_articles.length > 0 &&
        result.summary.success_count === 0
      ) {
        const errorArticle = result.error_articles[0];
        const errorMessage =
          errorArticle.errors?.join(", ") || "Order creation failed";

        return {
          statusCode: 400,
          message: `India Post Domestic API Error: ${errorMessage}`,
          partnerCode: PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
          metadata: {
            transporterId: "", // Empty as per requirement - keep structure same
          },
          data: {
            originalResponse: result,
            requestUrl: `${this.getBaseUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.BULK_BOOKING_JSON}/${customerId}`,
            requestBody: bulkBookingRequest,
            // Add shipmentDetails structure for consistency (matching India Post International pattern)
            shipmentDetails: {
              trackingDetails: [],
              documents: [],
            },
          },
          trace: {
            timestamp: new Date().toISOString(),
            partnerCode: PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
          },
        } as R;
      }

      // Create tracking details mapping from valid articles
      const trackingDetails = this.createTrackingDetailsMapping(
        result,
        orderDetails
      );

      // Generate label for valid articles
      const documents: any[] = [];
      if (result.valid_articles && result.valid_articles.length > 0) {
        try {
          const validArticle = result.valid_articles[0];
          // Get the original article from request (has all fields like article_type, dimensions)
          const originalArticle = bulkBookingRequest.articles[0];
          const labelBase64 = await this.generateLabel(
            validArticle,
            originalArticle,
            result,
            orderDetails,
            customerId
          );

          if (labelBase64) {
            documents.push({
              content: labelBase64,
              type: "label",
              format: "base64",
            });
          }
        } catch (labelError) {
          this.logger.error(
            `Label generation failed for order ${orderDetails.awbNumber}:`,
            labelError.message
          );
          // Continue without label - don't fail the order creation
        }
      }

      // Transform response to match expected BaseOrderResDto format (following India Post International structure)
      const response = {
        statusCode: 200,
        message: "Order created successfully with India Post Domestic",
        partnerCode: PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
        metadata: {
          transporterId: "", // Empty as per requirement - keep structure same
        },
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
          // Add shipmentDetails structure (matching India Post International pattern)
          shipmentDetails: {
            trackingDetails: trackingDetails,
            documents: documents,
          },
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

      // Get customer ID for context
      const customerId =
        this.configService.get<string>("INDIA_POST_DOMESTIC_CUSTOMER_ID") ||
        "1000000444";

      // Log error details for debugging
      if (error.response) {
        this.logger.error("Response status:", error.response.status);
        this.logger.error(
          "Response data:",
          JSON.stringify(error.response.data, null, 2)
        );
      }

      // Return consistent error structure (following UrbanBolt pattern)
      const errorResponse = {
        statusCode: error.status || error.response?.status || 400,
        message: `India Post Domestic API Error: ${error.response?.data?.message || error.message || "Unknown error"}`,
        partnerCode: PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
        metadata: {
          transporterId: "", // Empty as per requirement - keep structure same
        },
        data: {
          originalResponse: error.response?.data || null,
          requestUrl: `${this.getBaseUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.BULK_BOOKING_JSON}/${customerId}`,
          requestBody: null, // Will be populated if we have the request
          errorDetails: {
            name: error.name,
            message: error.message,
            code: error.code,
          },
          // Add shipmentDetails structure for consistency (matching India Post International pattern)
          shipmentDetails: {
            trackingDetails: [],
            documents: [],
          },
        },
        trace: {
          timestamp: new Date().toISOString(),
          partnerCode: PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
        },
      };

      // If it's already a CustomHttpException, throw it (maintains original behavior for auth errors, etc.)
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // For other errors, return the consistent structure instead of throwing (following UrbanBolt/DHL pattern)
      return errorResponse as R;
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
        (addr) => addr.type?.toUpperCase() === "PICKUP"
      );
      const deliveryAddress = orderData.addresses?.find(
        (addr) => addr.type?.toUpperCase() === "DELIVERY"
      );

      if (!pickupAddress || !deliveryAddress) {
        throw new Error("Both pickup and delivery addresses are required");
      }

      // Helper function to format phone numbers to 10 digits
      const formatPhoneNumber = (phone: string | undefined): string => {
        if (!phone) return "9999999999";
        const digits = phone.replace(/\D/g, "");
        if (digits.length >= 10) return digits.slice(-10); // Take last 10 digits
        return digits.padStart(10, "9"); // Pad with 9s if less than 10
      };

      // Helper function to format pincode to 6 digits
      const formatPincode = (pincode: string | undefined): string => {
        if (!pincode) return "560001";
        const digits = pincode.replace(/\D/g, "");
        if (digits.length === 6) return digits;
        if (digits.length > 6) return digits.slice(0, 6);
        return digits.padEnd(6, "0"); // Pad with 0s if less than 6
      };

      // Transform to India Post article format - ALL REQUIRED FIELDS INCLUDED
      // Note: India Post API requires many fields to be explicitly present (even as empty strings)
      // for their tariff calculation system. Using undefined causes fields to be omitted from JSON.
      // Use the generated AWB from parentShipment.awbNumber (which was set in createOrderV2)
      const generatedAWB = orderData.parentShipment?.awbNumber || "";
      if (!generatedAWB) {
        throw new Error(
          "Generated AWB number is required in parentShipment.awbNumber"
        );
      }

      const article: IndiaPostDomesticArticleDto = {
        // Basic Information (MANDATORY)
        bulk_customer_id: customerId,
        contract_id: contractId,
        barcode_no: generatedAWB, // Use generated AWB for India Post
        pickup_or_dropoff: "dropoff", // MANDATORY: "pickup" or "dropoff" (lowercase as per API docs sample)
        article_type: "SP", // MANDATORY: "SP" or "BP"

        // Physical Properties (MANDATORY)
        physical_weight: Math.round(
          parseFloat(
            orderData.parentShipment?.physicalWeight?.toString() || "100"
          )
        ), // Must be whole number between 1-35000 grams
        shape_of_article: "" as any, // Optional: "ROLL", "NROL", "DOC" - empty string if not specified
        length: parseFloat(
          orderData.parentShipment?.dimensions?.length?.toString() || "10"
        ),
        breadth_diameter: parseFloat(
          orderData.parentShipment?.dimensions?.width?.toString() || "10"
        ),
        height: parseFloat(
          orderData.parentShipment?.dimensions?.height?.toString() || "5"
        ),

        // Optional delivery settings - must be present for tariff calculation
        priority_flag: "" as any,
        delivery_instruction: "" as any,
        delivery_slot: "" as any,
        instruction_rts: "" as any,

        // Sender Information (MANDATORY FIELDS)
        sender_name: pickupAddress.name || "Sender Name",
        sender_company: pickupAddress.name || "Sender Company",
        sender_add_line_1: pickupAddress.street || "Sender Address",
        sender_add_line_2: pickupAddress.landmark || "",
        sender_city: pickupAddress.city || "Bangalore",
        sender_state: pickupAddress.state || "Karnataka",
        sender_pincode: formatPincode(pickupAddress.zip),
        sender_emailid: pickupAddress.email || "",
        sender_alt_contact: "",
        sender_kyc: "",
        sender_tax_reference: "",
        sender_mobile_no: formatPhoneNumber(pickupAddress.phone),

        // Receiver Information (MANDATORY FIELDS)
        receiver_name: deliveryAddress.name || "Receiver Name",
        receiver_company: deliveryAddress.name || "Receiver Company",
        receiver_add_line_1: deliveryAddress.street || "Receiver Address",
        receiver_add_line_2: deliveryAddress.landmark || "",
        receiver_city: deliveryAddress.city || "Delhi",
        receiver_state: deliveryAddress.state || "Delhi",
        receiver_pincode: formatPincode(deliveryAddress.zip),
        receiver_emailid: deliveryAddress.email || "",
        receiver_alt_contact: "",
        receiver_kyc: "",
        receiver_tax_reference: "",
        receiver_mobile_no: formatPhoneNumber(deliveryAddress.phone),

        // Address Flags (MANDATORY)
        alt_address_flag: false, // Boolean false means we're not using alternative address
        pickup_address_flag: false, // Boolean false means we're using dropoff
        drop_off_pincode: formatPincode(pickupAddress.zip),

        // Payment Information (MANDATORY for tariff calculation)
        // Note: For Prepaid orders, codr_cod and value_for_codr_cod should be empty
        prepayment_code: "" as any, // Optional enum: "PS" | "FM" | "SS"
        value_of_prepayment: 0,
        codr_cod: (orderData.payment?.type?.toUpperCase() === "COD"
          ? "COD"
          : "") as any,
        value_for_codr_cod:
          orderData.payment?.type?.toUpperCase() === "COD"
            ? parseFloat(orderData.payment?.finalAmount?.toString() || "0")
            : ("" as any), // Empty string for Prepaid, number for COD
        insurance_type: "" as any, // Optional enum: "DOP"
        value_of_insurance: 0,
        ack: false, // Optional boolean
        bulk_reference: orderData.orderId || orderData.awbNumber || "", // MANDATORY

        // Pickup Address (MANDATORY FIELDS - fill with actual data for dropoff mode)
        pickup_address_id: "" as any,
        pickup_addressee_name: pickupAddress.name || "Pickup Person",
        pickup_company_name: pickupAddress.name || "Pickup Company",
        pickup_address_line1: pickupAddress.street || "Pickup Address",
        pickup_address_line2: pickupAddress.landmark || "",
        pickup_address_line3: "",
        pickup_city: pickupAddress.city || "Bangalore",
        pickup_state: pickupAddress.state || "Karnataka",
        pickup_pincode: formatPincode(pickupAddress.zip),
        pickup_email_id: pickupAddress.email || "",
        pickup_alt_contact_no: "",
        pickup_mobile_no: formatPhoneNumber(pickupAddress.phone),
        pickup_schedule_slot: "",
        pickup_schedule_date: "",

        // Alternative Address (MANDATORY FIELDS - fill with receiver data)
        alt_addressee_name: deliveryAddress.name || "Alt Person",
        alt_company_name: deliveryAddress.name || "Alt Company",
        alt_address_line1: deliveryAddress.street || "Alt Address",
        alt_address_line2: deliveryAddress.landmark || "",
        alt_address_line3: "",
        alt_city: deliveryAddress.city || "Delhi",
        alt_state: deliveryAddress.state || "Delhi",
        alt_pincode: formatPincode(deliveryAddress.zip),
        alt_email_id: deliveryAddress.email || "",
        alt_contact_no: "",
        alt_alternate_mobile_no: formatPhoneNumber(deliveryAddress.phone),
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
  // HELPER METHODS FOR RESPONSE MAPPING
  // ================================

  /**
   * Create tracking details mapping from India Post Domestic bulk booking response
   * Maps valid articles to trackingDetails array (matching India Post International pattern)
   */
  private createTrackingDetailsMapping(
    bulkBookingResult: IndiaPostDomesticBulkBookingResDto,
    originalOrderDetails: BaseOrderReqDtoV2
  ): any[] {
    const trackingDetails: any[] = [];

    // If we have valid articles, map them to trackingDetails
    if (
      bulkBookingResult.valid_articles &&
      bulkBookingResult.valid_articles.length > 0
    ) {
      // Gather all shipments: parent + children in sequence
      const allShipments = [
        originalOrderDetails.parentShipment,
        ...(originalOrderDetails.childShipments || []),
      ].filter(Boolean);

      // Map each valid article to corresponding shipment AWB
      bulkBookingResult.valid_articles.forEach((article, index) => {
        const partnerAwbNumber = article.barcode_no || "";

        // Use the user's original AWB (orderDetails.awbNumber) for internal tracking
        // The partnerAwbNumber is the generated AWB that was sent to India Post
        const awbNumber =
          originalOrderDetails.awbNumber || originalOrderDetails.orderId || "";

        if (partnerAwbNumber) {
          trackingDetails.push({
            awbNumber: awbNumber, // User's original AWB for internal tracking
            partnerAwbNumber: partnerAwbNumber, // Generated AWB from India Post
            partnerName: PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
            transporterId: "",
          });
        }
      });
    } else {
      // Fallback: create a single tracking detail from order AWB
      // Use the user's original AWB for internal tracking
      const awbNumber =
        originalOrderDetails.awbNumber || originalOrderDetails.orderId || "";

      trackingDetails.push({
        awbNumber: awbNumber, // User's original AWB for internal tracking
        partnerAwbNumber:
          bulkBookingResult.valid_articles?.[0]?.barcode_no || "", // Generated AWB from India Post
        partnerName: PARTNER_CODE_ENUM.INDIA_POST_DOMESTIC,
        transporterId: "",
      });
    }

    return trackingDetails;
  }

  // ================================
  // LABEL GENERATION API
  // ================================

  /**
   * Generate address label for India Post Domestic order
   * Returns base64 encoded PDF label
   */
  private async generateLabel(
    validArticle: any, // From response - has barcode_no
    originalArticle: any, // From request - has article_type, dimensions, etc.
    bulkBookingResult: IndiaPostDomesticBulkBookingResDto,
    orderDetails: BaseOrderReqDtoV2,
    customerId: string
  ): Promise<string | null> {
    try {
      this.logger.log(
        `Generating label for barcode: ${validArticle.barcode_no}`
      );

      // Get addresses
      const pickupAddress = orderDetails.addresses?.find(
        (addr) => addr.type?.toUpperCase() === "PICKUP"
      );
      const deliveryAddress = orderDetails.addresses?.find(
        (addr) => addr.type?.toUpperCase() === "DELIVERY"
      );

      if (!pickupAddress || !deliveryAddress) {
        this.logger.error("Pickup or delivery address not found");
        return null;
      }

      // Format booking datetime (DD/MM/YYYY, HH:mm:ss)
      const bookingDate = new Date();
      const bookingDatetime = `${String(bookingDate.getDate()).padStart(2, "0")}/${String(bookingDate.getMonth() + 1).padStart(2, "0")}/${bookingDate.getFullYear()}, ${String(bookingDate.getHours()).padStart(2, "0")}:${String(bookingDate.getMinutes()).padStart(2, "0")}:${String(bookingDate.getSeconds()).padStart(2, "0")}`;

      // Helper function to format phone numbers
      const formatPhoneNumber = (phone: string | undefined): string => {
        if (!phone) return "";
        const digits = phone.replace(/\D/g, "");
        if (digits.length >= 10) return digits.slice(-10);
        return digits.padStart(10, "9");
      };

      // Helper function to format pincode
      const formatPincode = (pincode: string | undefined): string => {
        if (!pincode) return "";
        const digits = pincode.replace(/\D/g, "");
        if (digits.length === 6) return digits;
        if (digits.length > 6) return digits.slice(0, 6);
        return digits.padEnd(6, "0");
      };

      // Determine payment type and values
      const isCOD = orderDetails.payment?.type?.toUpperCase() === "COD";
      const prepaidFlag = !isCOD;
      const prepaidType = "";
      const prepaidValue = isCOD
        ? 0
        : parseFloat(orderDetails.payment?.finalAmount?.toString() || "0");
      const vpcodType = isCOD ? "COD" : "";
      const vpcodValue = isCOD
        ? parseFloat(orderDetails.payment?.finalAmount?.toString() || "0")
        : 0;

      // Map article_type to service_type for label API
      // Based on API docs, service_type can be various values
      // Using article_type directly (SP/BP) or mapped value
      // Note: Sample shows "LETTER" but that might be for a different service
      const articleType = originalArticle.article_type || "SP";
      // Try using article_type directly first, fallback to mapped value
      const serviceType = articleType; // Use SP or BP directly

      // Build label request payload
      const labelPayload = {
        identifier: "Domestic",
        delivery_office_name: "", // Not mandatory, can be empty
        booking_datetime: bookingDatetime,
        channel_type: "E", // E = Electronic
        user_type: "R", // R = Retail (can be G, D, A, T)
        user_id: parseInt(customerId) || 0,
        barcode_no: validArticle.barcode_no,
        service_type: serviceType,
        booking_type: "COM", // COM = Commercial
        customer_id: parseInt(customerId) || 0,
        article_length: String(
          originalArticle.length ||
            orderDetails.parentShipment?.dimensions?.length ||
            "14"
        ),
        article_breadth: String(
          originalArticle.breadth_diameter ||
            orderDetails.parentShipment?.dimensions?.width ||
            "9"
        ),
        article_height: String(
          originalArticle.height ||
            orderDetails.parentShipment?.dimensions?.height ||
            "1"
        ),
        prepaid_flag: prepaidFlag,
        prepaid_type: prepaidType,
        prepaid_value: prepaidValue,
        vpcod_type: vpcodType,
        vpcod_value: vpcodValue,
        insurance_flag: false,
        insurance_value: 0,
        physical_weight:
          originalArticle.physical_weight ||
          parseFloat(
            orderDetails.parentShipment?.physicalWeight?.toString() || "100"
          ),
        volumetric_weight: parseFloat(
          orderDetails.parentShipment?.volumetricWeight?.toString() || "0"
        ),
        recipient_name: deliveryAddress.name || "Receiver Name",
        recipient_mobile: formatPhoneNumber(deliveryAddress.phone),
        recipient_addressl1: deliveryAddress.street || "",
        recipient_addressl2: deliveryAddress.landmark || "",
        recipient_addressl3: "",
        recipient_city: deliveryAddress.city || "",
        recipient_pin: formatPincode(deliveryAddress.zip),
        recipient_state: deliveryAddress.state || "",
        sender_name: pickupAddress.name || "Sender Name",
        sender_mobile: formatPhoneNumber(pickupAddress.phone),
        sender_addressl1: pickupAddress.street || "",
        sender_addressl2: pickupAddress.landmark || "",
        sender_addressl3: "",
        sender_city: pickupAddress.city || "",
        sender_pin: formatPincode(pickupAddress.zip),
        sender_state: pickupAddress.state || "",
        transmission_mode: "A", // A = Air, S = Surface
        payment_mode: "QR", // QR = Quick Response
        routing_data: "",
        // booking_office_name is REQUIRED by API (422 if empty). Use pickup city as fallback.
        booking_office_name: pickupAddress.city
          ? `${pickupAddress.city} SO`
          : " ",
        booking_office_pin: formatPincode(pickupAddress.zip),
        size: "A7", // Label size
        total_amount: bulkBookingResult.summary?.total_tariff_amount || 0,
        value_added_services: "ND", // ND = Normal Delivery
      };

      // Get authentication headers
      const authHeaders = await this.authProvider.getAuthHeaders();
      const url = `${this.getBaseUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.GENERATE_LABEL}`;

      this.logger.log(`Calling label generation API: ${url}`);
      this.logger.debug(
        `Label payload: ${JSON.stringify(labelPayload, null, 2)}`
      );

      // Call label API - response will be PDF
      const response = await firstValueFrom(
        this.httpService.post(url, labelPayload, {
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer", // Important: Get binary PDF data
          timeout: INDIA_POST_DOMESTIC_CONFIG.HTTP_TIMEOUT_MS,
        })
      );

      // Check if response is actually PDF
      if (!response.data || response.data.length === 0) {
        this.logger.error("Label API returned empty response");
        return null;
      }

      // Convert PDF buffer to base64
      const pdfBuffer = Buffer.from(response.data);
      const base64Label = pdfBuffer.toString("base64");

      if (!base64Label || base64Label.length === 0) {
        this.logger.error("Failed to convert PDF to base64");
        return null;
      }

      this.logger.log(
        `Label generated successfully for barcode: ${validArticle.barcode_no}, size: ${base64Label.length} bytes`
      );

      return base64Label;
    } catch (error) {
      this.logger.error(
        `Label generation failed for barcode ${validArticle?.barcode_no}:`,
        error.message
      );

      if (error.response) {
        this.logger.error("Label API response status:", error.response.status);
        this.logger.error(
          "Label API response headers:",
          error.response.headers
        );

        // Try to parse error response
        if (error.response.data) {
          try {
            // If it's a buffer, try to convert to string
            if (Buffer.isBuffer(error.response.data)) {
              const errorText = error.response.data.toString("utf-8");
              this.logger.error("Label API error response:", errorText);
            } else {
              this.logger.error(
                "Label API error response:",
                JSON.stringify(error.response.data)
              );
            }
          } catch (parseError) {
            this.logger.error("Could not parse error response");
          }
        }
      } else if (error.request) {
        this.logger.error(
          "Label API request was made but no response received"
        );
      } else {
        this.logger.error("Label API error:", error.message);
        this.logger.error("Error stack:", error.stack);
      }

      return null;
    }
  }

  // ================================
  // FUTURE API IMPLEMENTATIONS
  // ================================

  // These methods will be implemented as we add more APIs:
  // - searchPincode()
  // - calculateTariff()
  // - trackMultipleOrders()
  // - getServiceAvailability()
  // - etc.
}
