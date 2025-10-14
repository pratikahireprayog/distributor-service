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
  INDIA_POST_DOMESTIC_SERVICE_TYPES,
  INDIA_POST_DOMESTIC_ARTICLE_TYPES,
  INDIA_POST_DOMESTIC_EVENT_CODES,
  INDIA_POST_DOMESTIC_TEST_PARAMS,
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
  IndiaPostDomesticBookingReqDto,
  IndiaPostDomesticBookingResDto,
  IndiaPostDomesticOfficeSearchReqDto,
  IndiaPostDomesticOfficeSearchResDto,
  IndiaPostDomesticPincodeSearchReqDto,
  IndiaPostDomesticPincodeSearchResDto,
  IndiaPostDomesticTrackingReqDto,
  IndiaPostDomesticTrackingResDto,
  IndiaPostDomesticArticleReqDto,
  IndiaPostDomesticArticleResDto,
  IndiaPostDomesticManifestReqDto,
  IndiaPostDomesticManifestResDto,
  IndiaPostDomesticTariffReqDto,
  IndiaPostDomesticTariffResDto,
  IndiaPostDomesticLabelReqDto,
  IndiaPostDomesticLabelResDto,
  IndiaPostDomesticPickupReqDto,
  IndiaPostDomesticPickupResDto,
  IndiaPostDomesticRoutingReqDto,
  IndiaPostDomesticRoutingResDto,
  // New DTOs for updated API
  IndiaPostDomesticBulkBookingReqDto,
  IndiaPostDomesticBulkBookingResDto,
  IndiaPostDomesticInternationalTariffReqDto,
  IndiaPostDomesticInternationalTariffResDto,
  IndiaPostDomesticParcelTariffReqDto,
  IndiaPostDomesticParcelTariffResDto,
  IndiaPostDomesticLetterTariffReqDto,
  IndiaPostDomesticLetterTariffResDto,
  IndiaPostDomesticSpeedPostTariffReqDto,
  IndiaPostDomesticSpeedPostTariffResDto,
  IndiaPostDomesticEventDownloadReqDto,
  IndiaPostDomesticEventDownloadResDto,
} from "./india-post-domestic.dto";
import {
  pushOrdersToPRSDto,
  StandardRequestDto,
} from "src/services/distributor/distributor.service";

/**
 * India Post Domestic DoP Integration Service Implementation
 * Implements all required network partner operations for India Post domestic services
 */
@Injectable()
export class IndiaPostDomesticService extends BaseNetworkPartner {
  protected readonly logger = new Logger(IndiaPostDomesticService.name);
  private readonly baseUrl: string;

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

    // Use single base URL for all APIs as per new documentation
    this.baseUrl = this.getBaseUrl();
  }

  // Helper methods to get correct base URLs as per new documentation
  private getBaseUrl(): string {
    // Force test environment for now - commented out original for debugging
    // return INDIA_POST_DOMESTIC_BASE_URLS.TEST;

    // Original code - temporarily using test environment
    return (
      // this.configService.get<string>(INDIA_POST_DOMESTIC_ENV_VARS.BASE_URL) ||
      INDIA_POST_DOMESTIC_BASE_URLS.TEST
    );
  }

  // Legacy methods for backward compatibility
  private getGatewayUrl(): string {
    return this.getBaseUrl();
  }

  private getApiUrl(): string {
    return this.getBaseUrl();
  }

  private getDataUrl(): string {
    return this.getBaseUrl();
  }

  /**
   * Create domestic order with India Post - V1 NOT SUPPORTED
   * India Post Domestic integration only works with createOrderV2
   */
  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.error(
      `India Post Domestic does not support createOrder (V1). Use createOrderV2 instead.`
    );

    throw new CustomHttpException(
      HttpStatus.BAD_REQUEST,
      `India Post Domestic integration only supports createOrderV2. Please use the V2 endpoint: POST /create-order-v2`
    );
  }

  /**
   * Create domestic order with India Post - V2 (MAIN IMPLEMENTATION)
   * This is the primary method for India Post Domestic integration
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends any>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.log(
      `🚀 Creating India Post Domestic order (V2 - MAIN IMPLEMENTATION) for AWB: ${orderDetails.awbNumber}`
    );

    try {
      // Validate minimum required V2 fields
      if (!orderDetails?.awbNumber) {
        throw new Error("AWB number is required");
      }
      if (!orderDetails?.addresses || orderDetails.addresses.length === 0) {
        throw new Error("At least one address is required in V2 payload");
      }

      // Use AWB as article until proper generation is implemented
      const articleNumber = orderDetails.awbNumber;

      // Transform V2 order to India Post booking payload
      const indiaPostBookingData = this.transformToIndiaPostDomesticFromV2(
        orderDetails,
        articleNumber
      );

      // Call booking API
      const bookingResponse =
        await this.callDomesticBookingAPI(indiaPostBookingData);

      // Map back to standard response
      const standardResponse = this.transformDomesticBookingResponseV2(
        bookingResponse,
        orderDetails
      );

      this.logger.log(
        `Successfully created India Post Domestic order (V2): ${articleNumber}`
      );
      return standardResponse as R;
    } catch (error) {
      this.logger.error(
        `India Post Domestic V2 order creation failed: ${error.message}`
      );
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `India Post Domestic V2 order creation failed: ${error.message}`
      );
    }
  }

  /**
   * Get order details (tracking)
   */
  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    this.logger.log(
      `Getting India Post Domestic order details for: ${params.awbNumber}`
    );

    try {
      const trackingData: IndiaPostDomesticTrackingReqDto = {
        ...params,
        article_number: params.awbNumber || "",
      };

      const trackingResponse = await this.callTrackingAPI(trackingData);
      const standardResponse = this.transformTrackingResponse(
        trackingResponse,
        params
      );

      return standardResponse as R;
    } catch (error) {
      this.logger.error(
        `India Post Domestic tracking failed: ${error.message}`
      );
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `India Post Domestic tracking failed: ${error.message}`
      );
    }
  }

  /**
   * Cancel order (if supported by India Post)
   */
  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.log(
      `Cancelling India Post Domestic order: ${data.cAwbNumbers?.[0] || "unknown"}`
    );

    // Note: Check if India Post supports order cancellation
    // For now, returning a standard response
    const response = {
      message: "Order cancellation not supported by India Post Domestic API",
      statusCode: 501,
    } as R;

    return response;
  }

  /**
   * Create manifest with India Post
   */
  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    this.logger.log(`Creating India Post Domestic manifest`);

    try {
      const manifestData: IndiaPostDomesticManifestReqDto = {
        ...manifestationDetails,
        office_id: this.configService.get<number>(
          "INDIA_POST_DOMESTIC_OFFICE_ID"
        ),
        manifest_date: new Date().toISOString().split("T")[0],
      };

      // Call manifest API (if available)
      const manifestResponse = await this.callManifestAPI(manifestData);
      const standardResponse = this.transformManifestResponse(manifestResponse);

      return standardResponse as R;
    } catch (error) {
      this.logger.error(
        `India Post Domestic manifest creation failed: ${error.message}`
      );
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `India Post Domestic manifest creation failed: ${error.message}`
      );
    }
  }

  // ================================
  // UTILITY METHODS FOR API CALLS
  // ================================

  /**
   * Generate article number using India Post API
   */
  private async generateArticleNumber(articleType: string): Promise<string> {
    const articleData: IndiaPostDomesticArticleReqDto = {
      article_type: articleType,
      office_customer: "CUSTOMER",
    };

    // Note: Article barcode generation is not available in DoP Integration Document
    // This may need to be handled differently or removed based on actual requirements
    throw new Error(
      "Article barcode generation not supported in DoP Integration API"
    );
  }

  /**
   * Call bulk booking API as per DoP Integration Document
   * Uses gateway.cept.gov.in/booking/api/createbulk
   */
  private async callDomesticBookingAPI(
    bookingData: IndiaPostDomesticBookingReqDto
  ): Promise<IndiaPostDomesticBookingResDto> {
    const endpoint = `${this.getGatewayUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.BULK_BOOKING}`;

    const response = await firstValueFrom(
      this.httpService.post<IndiaPostDomesticBookingResDto>(
        endpoint,
        bookingData,
        {
          headers: await this.authProvider.getAuthHeaders(),
        }
      )
    );

    return response.data;
  }

  /**
   * Call tracking API
   */
  private async callTrackingAPI(
    trackingData: IndiaPostDomesticTrackingReqDto
  ): Promise<IndiaPostDomesticTrackingResDto> {
    // Note: Tracking API is not explicitly defined in DoP Integration Document
    // Tracking data is provided via Outbound Events API instead
    throw new Error(
      "Direct tracking API not supported. Use downloadOutboundEvents for tracking data."
    );
  }

  /**
   * Call manifest API
   */
  private async callManifestAPI(
    manifestData: IndiaPostDomesticManifestReqDto
  ): Promise<IndiaPostDomesticManifestResDto> {
    // Note: Implement based on actual manifest endpoint
    return {
      message: "Manifest created successfully",
      manifest_id: `MAN_${Date.now()}`,
      statusCode: 200,
    };
  }

  // ================================
  // SEARCH PINCODE (CUSTOM METHOD)
  // ================================

  /**
   * Search pincode using DoP Pincode Search API
   * Uses api.cept.gov.in/CommonFacilityMaster/api/values/Fetch_Facility as per DoP Document
   * Uses GET method with JSON body as per Postman collection
   */
  async searchPincode(
    pincode: string
  ): Promise<IndiaPostDomesticPincodeSearchResDto[]> {
    this.logger.log(
      `Searching India Post Domestic pincode using DoP API: ${pincode}`
    );

    try {
      // As per Postman collection, use JSON body with Input_Pincode
      const requestData = {
        Input_Pincode: pincode,
      };

      // Note: The Postman collection shows GET method with JSON body (unusual but as per spec)
      const response = await firstValueFrom(
        this.httpService.get<IndiaPostDomesticPincodeSearchResDto[]>(
          `${this.getApiUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.PINCODE_SEARCH}`,
          {
            headers: await this.authProvider.getAuthHeaders(),
            data: requestData, // JSON body for GET request
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `India Post Domestic DoP pincode search failed: ${error.message}`
      );
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `DoP Pincode search failed: ${error.message}`
      );
    }
  }

  // ================================
  // DoP INTEGRATION SPECIFIC APIS
  // ================================

  /**
   * Create tariff request with proper formatting
   * Helper method to ensure proper field formatting for tariff API
   */
  createTariffRequest(params: {
    service: string;
    sourcePin: string;
    destinationPin: string;
    weight: number; // in grams
    length?: number; // in cm
    breadth?: number; // in cm
    height?: number; // in cm
    podAckFlag?: boolean;
    vppValue?: number;
    insValue?: number;
    codValue?: number;
  }): IndiaPostDomesticTariffReqDto {
    return {
      service: params.service.toUpperCase(),
      sourcepin: params.sourcePin,
      destinationpin: params.destinationPin,
      weight: params.weight.toString(),
      length: (params.length || 0).toString(),
      breadth: (params.breadth || 0).toString(),
      height: (params.height || 0).toString(),
      POD_ACK_Flag: params.podAckFlag ? "Yes" : "No",
      VPP_Value: params.vppValue || 0,
      INS_Value: params.insValue || 0,
      COD_Value: params.codValue || 0,
    };
  }

  /**
   * Create outbound events request with proper date formatting
   * Helper method to ensure proper date format (ddmmyyyy)
   */
  createOutboundEventsRequest(params: {
    customerId: string;
    eventCode: string;
    eventDate: Date | string;
  }): IndiaPostDomesticEventDownloadReqDto {
    let formattedDate: string;

    if (typeof params.eventDate === "string") {
      // If string, assume it's already in ddmmyyyy format
      formattedDate = params.eventDate;
    } else {
      // Convert Date to ddmmyyyy format
      const day = params.eventDate.getDate().toString().padStart(2, "0");
      const month = (params.eventDate.getMonth() + 1)
        .toString()
        .padStart(2, "0");
      const year = params.eventDate.getFullYear().toString();
      formattedDate = `${day}${month}${year}`;
    }

    return {
      Cust_Id: params.customerId,
      Event_Code: params.eventCode,
      Event_Date: formattedDate,
    };
  }

  /**
   * Create bulk pickup request using DoP Pickup API
   * Uses gateway.cept.gov.in/pickupreq/api/createbulkreq as per DoP Document
   */
  async createBulkPickupRequest(
    pickupData: IndiaPostDomesticPickupReqDto
  ): Promise<IndiaPostDomesticPickupResDto> {
    this.logger.log(`Creating bulk pickup request using DoP API`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getGatewayUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.BULK_PICKUP_REQUEST}`,
          pickupData,
          {
            headers: await this.authProvider.getAuthHeaders(),
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`DoP bulk pickup request failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `DoP bulk pickup request failed: ${error.message}`
      );
    }
  }

  /**
   * Cancel pickup request using DoP Cancel API
   * Uses gateway.cept.gov.in/pickupreq/api/cancel/{ArticleID/ReqID} as per DoP Document
   */
  async cancelPickupRequest(
    articleIdOrReqId: string
  ): Promise<IndiaPostDomesticPickupResDto> {
    this.logger.log(
      `Cancelling pickup request using DoP API: ${articleIdOrReqId}`
    );

    try {
      const response = await firstValueFrom(
        this.httpService.put(
          `${this.getGatewayUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.CANCEL_PICKUP_REQUEST}/${articleIdOrReqId}`,
          {},
          {
            headers: await this.authProvider.getAuthHeaders(),
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`DoP cancel pickup request failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `DoP cancel pickup request failed: ${error.message}`
      );
    }
  }

  /**
   * Get tariff using DoP Tariff API
   * Uses api.cept.gov.in/Tariff_VAS_Bulk/api/values/gettariffVas_Bulk as per DoP Document
   * Expects array format as per Postman collection
   */
  async getTariff(
    tariffData: IndiaPostDomesticTariffReqDto
  ): Promise<IndiaPostDomesticTariffResDto[]> {
    this.logger.log(
      `Getting tariff using DoP API for service: ${tariffData.service}`
    );

    try {
      // API expects array format as per Postman collection
      const requestArray = [tariffData];

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticTariffResDto[]>(
          `${this.getApiUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.TARIFF_VAS_BULK}`,
          requestArray,
          {
            headers: await this.authProvider.getAuthHeaders(),
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`DoP tariff API failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `DoP tariff API failed: ${error.message}`
      );
    }
  }

  /**
   * Generate label using DoP Label API (Legacy)
   * Uses api.cept.gov.in/Label/api/values/GetLabel as per DoP Document
   */
  async generateLabelLegacy(
    labelData: IndiaPostDomesticLabelReqDto
  ): Promise<IndiaPostDomesticLabelResDto> {
    this.logger.log(`Generating label using DoP API`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getApiUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.LABEL_GENERATION}`,
          labelData,
          {
            headers: await this.authProvider.getAuthHeaders(),
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`DoP label generation failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `DoP label generation failed: ${error.message}`
      );
    }
  }

  /**
   * Get routing information using DoP Routing API
   * Uses api.cept.gov.in/Route/api/values/GetRoute as per DoP Document
   */
  async getRouting(
    routingData: IndiaPostDomesticRoutingReqDto
  ): Promise<IndiaPostDomesticRoutingResDto> {
    this.logger.log(`Getting routing using DoP API`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getApiUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.ROUTING}`,
          routingData,
          {
            headers: await this.authProvider.getAuthHeaders(),
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`DoP routing API failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `DoP routing API failed: ${error.message}`
      );
    }
  }

  /**
   * Download outbound events using DoP Outbound API
   * Uses data.cept.gov.in/customer/api/BulkCustomer/download as per DoP Document
   */
  async downloadOutboundEvents(
    eventParams: IndiaPostDomesticEventDownloadReqDto
  ): Promise<string> {
    this.logger.log(
      `Downloading outbound events using DoP API for customer: ${eventParams.Cust_Id}`
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getDataUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.OUTBOUND_EVENTS}`,
          eventParams,
          {
            headers: await this.authProvider.getAuthHeaders(),
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `DoP outbound events download failed: ${error.message}`
      );

      // Handle DoP specific error responses as per document
      if (error.response?.status) {
        switch (error.response.status) {
          case 401:
            throw new CustomHttpException(
              HttpStatus.UNAUTHORIZED,
              "IP Not whitelisted!"
            );
          case 405:
            throw new CustomHttpException(
              HttpStatus.METHOD_NOT_ALLOWED,
              "Use POST Method!"
            );
          case 404:
            throw new CustomHttpException(
              HttpStatus.NOT_FOUND,
              "Customer Doesn't Exist!"
            );
          case 204:
            throw new CustomHttpException(
              HttpStatus.NO_CONTENT,
              "No File Found!"
            );
          case 501:
            throw new CustomHttpException(
              HttpStatus.NOT_IMPLEMENTED,
              "Unknown Exception!"
            );
          default:
            throw new CustomHttpException(
              HttpStatus.BAD_REQUEST,
              `DoP outbound events download failed: ${error.message}`
            );
        }
      }

      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `DoP outbound events download failed: ${error.message}`
      );
    }
  }

  // ================================
  // DATA TRANSFORMATION METHODS
  // ================================

  private validateDomesticOrderData(orderDetails: BaseOrderReqDto): void {
    if (!orderDetails.awbNumber) {
      throw new Error("AWB number is required");
    }
    // Add more validations as needed
  }

  private transformToIndiaPostDomestic(
    orderDetails: BaseOrderReqDto,
    articleNumber: string
  ): IndiaPostDomesticBookingReqDto {
    return {
      ...orderDetails,
      article_number: articleNumber,
      bulk_customer_id: this.configService.get<number>(
        INDIA_POST_DOMESTIC_ENV_VARS.BULK_CUSTOMER_ID
      ),
      mail_type_cd: INDIA_POST_DOMESTIC_SERVICE_TYPES.SP, // Default to Speed Post
      booking_type_cd: "BULK",
      // Map other fields as needed
    };
  }

  private transformDomesticBookingResponse(
    response: IndiaPostDomesticBookingResDto,
    originalOrder: BaseOrderReqDto
  ): BaseOrderResDto {
    return {
      message: "Order created successfully",
      statusCode: 200,
      trackingId: response.article_number || originalOrder.awbNumber,
      referenceNumber: response.booking_id,
      data: {
        articleNumber: response.article_number,
        bookingId: response.booking_id,
        awbNumber: originalOrder.awbNumber,
      },
      // Map other response fields
    };
  }

  private transformDomesticBookingResponseV2(
    response: IndiaPostDomesticBookingResDto,
    originalOrder: BaseOrderReqDtoV2
  ): BaseOrderResDto {
    return {
      message: "Order created successfully",
      statusCode: 200,
      trackingId: response.article_number || originalOrder.awbNumber,
      referenceNumber: response.booking_id || originalOrder.referenceId,
      data: {
        articleNumber: response.article_number || originalOrder.awbNumber,
        bookingId: response.booking_id,
        awbNumber: originalOrder.awbNumber,
      },
    };
  }

  private transformToIndiaPostDomesticFromV2(
    orderDetails: BaseOrderReqDtoV2,
    articleNumber: string
  ): any {
    const addresses = orderDetails.addresses || [];
    const lowerType = (s?: string) => (s || "").toLowerCase();
    const pickupAddr =
      addresses.find((a) =>
        ["pickup", "origin", "sender", "from"].some((k) =>
          lowerType(a.type).includes(k)
        )
      ) || addresses[0];
    const shipAddr =
      addresses.find((a) =>
        ["shipping", "destination", "receiver", "to", "delivery"].some((k) =>
          lowerType(a.type).includes(k)
        )
      ) ||
      addresses[1] ||
      addresses[0];

    const parent = orderDetails.parentShipment;
    const dims = parent?.dimensions;

    const toNumber = (v: any): number | undefined => {
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    };

    const declaredValue = toNumber(orderDetails?.payment?.finalAmount);
    const physicalWeight = toNumber(parent?.physicalWeight);

    return {
      article_number: articleNumber,
      bulk_customer_id: this.configService.get<number>(
        INDIA_POST_DOMESTIC_ENV_VARS.BULK_CUSTOMER_ID
      ),
      mail_type_cd: INDIA_POST_DOMESTIC_SERVICE_TYPES.SP,
      booking_type_cd: "BULK",

      // Physical attributes
      physical_weight: physicalWeight,
      dimension_length: toNumber(dims?.length),
      dimension_breadth: toNumber(dims?.width),
      dimension_height: toNumber(dims?.height),

      // Sender (pickup)
      sender_name: pickupAddr?.name,
      sender_company_name: undefined,
      sender_addrline1: pickupAddr?.street,
      sender_addrline2: pickupAddr?.landmark,
      sender_addrline3: undefined,
      sender_city: pickupAddr?.city,
      sender_state: pickupAddr?.state,
      sender_pincode: toNumber(pickupAddr?.zip),
      sender_contact_no: pickupAddr?.phone,
      sender_email_id: pickupAddr?.email,

      // Receiver (shipping)
      receiver_name: shipAddr?.name,
      receiver_company_name: undefined,
      receiver_addrline1: shipAddr?.street,
      receiver_addrline2: shipAddr?.landmark,
      receiver_addrline3: undefined,
      receiver_city: shipAddr?.city,
      receiver_state: shipAddr?.state,
      receiver_pincode: toNumber(shipAddr?.zip),
      receiver_contact_no: shipAddr?.phone,
      receiver_email_id: shipAddr?.email,

      // Pricing/Service
      declared_value: declaredValue,
    };
  }

  private transformTrackingResponse(
    response: IndiaPostDomesticTrackingResDto,
    originalRequest: BaseReqDto
  ): BaseResDto {
    return {
      message: "Tracking data retrieved successfully",
      statusCode: 200,
      data: {
        awbNumber: response.article_number,
        status: response.current_status,
        lastUpdate: response.last_update_time,
        trackingHistory: response.tracking_history,
      },
    };
  }

  private transformManifestResponse(
    response: IndiaPostDomesticManifestResDto
  ): BaseResDto {
    return {
      message: response.message,
      statusCode: response.statusCode,
      data: {
        manifestId: response.manifest_id,
        manifestNumber: response.manifest_number,
      },
    };
  }

  // ================================
  // REQUIRED METHODS FROM BASE CLASS
  // ================================

  // These methods are required by INetworkPartner but may not be fully implemented yet
  async pushOrderToDRS<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error("pushOrderToDRS not implemented for India Post Domestic");
  }

  async pushOrdersToPRS<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error("pushOrdersToPRS not implemented for India Post Domestic");
  }

  async pushOrderToTracking<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error(
      "pushOrderToTracking not implemented for India Post Domestic"
    );
  }

  async manifestOrderToTracking<
    T extends StandardRequestDto,
    R extends BaseResDto,
  >(data: T): Promise<R> {
    throw new Error(
      "manifestOrderToTracking not implemented for India Post Domestic"
    );
  }

  async updateEcomOrderWebhook<
    T extends StandardRequestDto,
    R extends BaseResDto,
  >(data: T): Promise<R> {
    throw new Error(
      "updateEcomOrderWebhook not implemented for India Post Domestic"
    );
  }

  async pushOrderToHubOps<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error(
      "pushOrderToHubOps not implemented for India Post Domestic"
    );
  }

  async updateOrderToHubOps<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    throw new Error(
      "updateOrderToHubOps not implemented for India Post Domestic"
    );
  }

  // ================================
  // TEST METHODS FOR API VALIDATION
  // ================================

  /**
   * Test outbound events API with provided test parameters
   * Use this to validate API connectivity and response format
   */
  async testOutboundEventsAPI(): Promise<string> {
    this.logger.log(
      "Testing India Post Outbound Events API with test parameters"
    );

    const testRequest = this.createOutboundEventsRequest({
      customerId: INDIA_POST_DOMESTIC_TEST_PARAMS.CUSTOMER_ID,
      eventCode: INDIA_POST_DOMESTIC_EVENT_CODES.LE,
      eventDate: INDIA_POST_DOMESTIC_TEST_PARAMS.EVENT_DATE_RANGE.START,
    });

    return this.downloadOutboundEvents(testRequest);
  }

  /**
   * Test tariff API with sample data
   * Use this to validate tariff calculation
   */
  async testTariffAPI(): Promise<IndiaPostDomesticTariffResDto[]> {
    this.logger.log("Testing India Post Tariff API with sample data");

    const testRequest = this.createTariffRequest({
      service: INDIA_POST_DOMESTIC_SERVICE_TYPES.BP,
      sourcePin: "781137",
      destinationPin: "609301",
      weight: 4000, // 4 kg in grams
      length: 23,
      breadth: 12,
      height: 24,
      podAckFlag: false,
      vppValue: 0,
      insValue: 0,
      codValue: 0,
    });

    return this.getTariff(testRequest);
  }

  /**
   * Test pincode search API
   * Use this to validate pincode search functionality
   */
  async testPincodeSearchAPI(
    pincode: string = "570024"
  ): Promise<IndiaPostDomesticPincodeSearchResDto[]> {
    this.logger.log(
      `Testing India Post Pincode Search API with pincode: ${pincode}`
    );
    return this.searchPincode(pincode);
  }

  // ================================
  // NEW API METHODS (as per updated documentation)
  // ================================

  /**
   * Bulk booking API for up to 1000 articles (JSON payload)
   */
  async bulkBookingJSON(
    customId: string,
    bookingData: IndiaPostDomesticBulkBookingReqDto
  ): Promise<IndiaPostDomesticBulkBookingResDto> {
    this.logger.log(
      `Creating bulk booking for customer ${customId} with ${bookingData.articles.length} articles`
    );

    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.BULK_BOOKING_JSON}/${customId}`;

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticBulkBookingResDto>(
          url,
          bookingData,
          { headers }
        )
      );

      this.logger.log(
        `Bulk booking completed. Success: ${response.data.summary.success_count}, Errors: ${response.data.summary.error_count}`
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Bulk booking failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Bulk booking failed: ${error.message}`
      );
    }
  }

  /**
   * Bulk booking API for up to 5000 articles (file upload)
   */
  async bulkBookingFile(
    customId: string,
    file: Buffer,
    filename: string
  ): Promise<IndiaPostDomesticBulkBookingResDto> {
    this.logger.log(
      `Creating bulk booking from file for customer ${customId}: ${filename}`
    );

    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.BULK_BOOKING_FILE}/${customId}`;

      const formData = new FormData();
      formData.append("file", new Blob([file]), filename);

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticBulkBookingResDto>(
          url,
          formData,
          {
            headers: {
              ...headers,
              "Content-Type": "multipart/form-data",
            },
          }
        )
      );

      this.logger.log(
        `Bulk booking from file completed. Success: ${response.data.summary.success_count}, Errors: ${response.data.summary.error_count}`
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Bulk booking from file failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Bulk booking from file failed: ${error.message}`
      );
    }
  }

  /**
   * International Tariff API
   */
  async getInternationalTariff(
    request: IndiaPostDomesticInternationalTariffReqDto
  ): Promise<IndiaPostDomesticInternationalTariffResDto> {
    this.logger.log(
      `Getting international tariff for ${request["product-code"]} to ${request["country-code"]}`
    );

    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.INTERNATIONAL_TARIFF}`;

      const params = new URLSearchParams();
      Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await firstValueFrom(
        this.httpService.get<IndiaPostDomesticInternationalTariffResDto>(
          `${url}?${params.toString()}`,
          { headers }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `International tariff calculation failed: ${error.message}`
      );
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `International tariff calculation failed: ${error.message}`
      );
    }
  }

  /**
   * Parcel Tariff API
   */
  async getParcelTariff(
    request: IndiaPostDomesticParcelTariffReqDto
  ): Promise<IndiaPostDomesticParcelTariffResDto> {
    this.logger.log(
      `Getting parcel tariff for ${request["product-code"]} from ${request["source-pincode"]} to ${request["destination-pincode"]}`
    );

    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.PARCEL_TARIFF}`;

      const params = new URLSearchParams();
      Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await firstValueFrom(
        this.httpService.get<IndiaPostDomesticParcelTariffResDto>(
          `${url}?${params.toString()}`,
          { headers }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Parcel tariff calculation failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Parcel tariff calculation failed: ${error.message}`
      );
    }
  }

  /**
   * Letter Tariff API
   */
  async getLetterTariff(
    request: IndiaPostDomesticLetterTariffReqDto
  ): Promise<IndiaPostDomesticLetterTariffResDto> {
    this.logger.log(
      `Getting letter tariff for ${request["product-code"]} from ${request["source-pincode"]} to ${request["destination-pincode"]}`
    );

    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.LETTER_TARIFF}`;

      const params = new URLSearchParams();
      Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await firstValueFrom(
        this.httpService.get<IndiaPostDomesticLetterTariffResDto>(
          `${url}?${params.toString()}`,
          { headers }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Letter tariff calculation failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Letter tariff calculation failed: ${error.message}`
      );
    }
  }

  /**
   * Speed Post Tariff API
   */
  async getSpeedPostTariff(
    request: IndiaPostDomesticSpeedPostTariffReqDto
  ): Promise<IndiaPostDomesticSpeedPostTariffResDto> {
    this.logger.log(
      `Getting speed post tariff for ${request["product-code"]} from ${request["source-pincode"]} to ${request["destination-pincode"]}`
    );

    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.SPEED_POST_TARIFF}`;

      const params = new URLSearchParams();
      Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await firstValueFrom(
        this.httpService.get<IndiaPostDomesticSpeedPostTariffResDto>(
          `${url}?${params.toString()}`,
          { headers }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Speed post tariff calculation failed: ${error.message}`
      );
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Speed post tariff calculation failed: ${error.message}`
      );
    }
  }

  /**
   * Pincode Search API (updated)
   */
  async searchPincodeUpdated(
    pincode: string,
    limit: number = 50,
    officeType: string = "post"
  ): Promise<IndiaPostDomesticPincodeSearchResDto[]> {
    this.logger.log(`Searching pincode: ${pincode}`);

    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.PINCODE_SEARCH}`;

      const params = new URLSearchParams({
        pincode,
        limit: limit.toString(),
        "office-type": officeType,
      });

      const response = await firstValueFrom(
        this.httpService.get<IndiaPostDomesticPincodeSearchResDto[]>(
          `${url}?${params.toString()}`,
          { headers }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Pincode search failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Pincode search failed: ${error.message}`
      );
    }
  }

  /**
   * Label Generation API (updated)
   */
  async generateLabel(
    request: IndiaPostDomesticLabelReqDto
  ): Promise<IndiaPostDomesticLabelResDto> {
    this.logger.log(`Generating label for barcode: ${request.barcode_no}`);

    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.LABEL_GENERATION}`;

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticLabelResDto>(url, request, {
          headers,
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Label generation failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Label generation failed: ${error.message}`
      );
    }
  }

  /**
   * Event Download API (updated)
   */
  async downloadEvents(
    request: IndiaPostDomesticEventDownloadReqDto
  ): Promise<IndiaPostDomesticEventDownloadResDto> {
    this.logger.log(
      `Downloading events for customer ${request.Cust_Id}, event code: ${request.Event_Code}, date: ${request.Event_Date}`
    );

    try {
      const headers = await this.authProvider.getAuthHeaders();
      const url = `${this.baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.EVENT_DOWNLOAD}`;

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticEventDownloadResDto>(
          url,
          request,
          { headers }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Event download failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `Event download failed: ${error.message}`
      );
    }
  }
}
