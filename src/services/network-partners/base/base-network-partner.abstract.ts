import { HttpService } from "@nestjs/axios";
import { HttpStatus, Logger } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import {
  SchemaMapperService,
  SchemaMappingConfig,
} from "src/infrastructure/schema-mapper";
import { AuthProvider } from "../interfaces/auth-provider.interface";
import { INetworkPartner } from "../interfaces/network-partner.interface";
import { EndpointConfigModel } from "src/common/repositories/endpoint-configs/endpoint-configs.schema";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { ENDPOINT_ID_ENUM, PARTNER_CODE_ENUM } from "src/common/enums";
import {
  BaseReqDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseResDto,
  BaseCancelOrderDto,
  DRSPayloadDTO,
  ManifestReqDto,
  BaseOrderReqDtoV2
} from "src/common/dtos/base.dto";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { BaseNetworkPartnerHelper } from "./base-network-partner-helper.service";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import {
  pushOrdersToPRSDto,
  StandardRequestDto,
} from "src/services/distributor/distributor.service";

/**
 * Base abstract class for network partner activities
 * Implements common functionality for all network partners
 */
export abstract class BaseNetworkPartner implements INetworkPartner {
  protected readonly logger: Logger;

  constructor(
    protected readonly partnerCode: PARTNER_CODE_ENUM,
    protected readonly authProvider: AuthProvider,
    protected readonly httpService: HttpService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>,
    protected readonly partnerHelper?: BaseNetworkPartnerHelper
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderData: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.debug(`Creating Order with partner ${this.partnerCode}`);
    let existingPartners: any;
    let attemptNumber = 1;
    let partnerType = partnerCode;
    const startTime = Date.now();

    try {
      // Use the helper if available to handle partner tracking and selection
      // if (this.partnerHelper) {
      //   // Step 1: Load or store partner data
      //   existingPartners = await this.partnerHelper.loadOrStorePartners(
      //     orderData.awbNumber,
      //     eligiblePartners
      //   );

      //   // Step 2: Determine which partner to use
      //   partnerType = await this.partnerHelper.determinePartnerWithEligibility(
      //     orderData,
      //     eligiblePartners
      //   );

      //   // Make sure partnerCode in orderData matches the selected partner
      //   orderData.partnerCode = partnerType;

      //   // Step 3: Get current attempt number
      //   attemptNumber = this.partnerHelper.getAttemptNumber(
      //     existingPartners,
      //     partnerType
      //   );
      // }

      const endpointConfig = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.CREATE_ORDER,
        partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.CREATE_ORDER,
          orderData
        )
      ) {
        throw new Error("Invalid input data for CREATE_ORDER operation");
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.CREATE_ORDER,
        orderData,
        partnerCode,
        endpointConfig
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.CREATE_ORDER,
        response
      ) as R;

      // Calculate response time
      const responseTimeMs = Date.now() - startTime;

      // Record successful attempt if helper is available
      if (this.partnerHelper) {
        await this.partnerHelper.recordSuccessfulAttempt(
          orderData.awbNumber,
          partnerType,
          existingPartners,
          eligiblePartners,
          attemptNumber,
          result,
          responseTimeMs,
          orderData
        );
      }

      return result;
    } catch (error) {
      // Calculate response time for error tracking
      error.responseTimeMs = Date.now() - startTime;

      // Record failed attempt if helper is available
      if (this.partnerHelper) {
        await this.partnerHelper.recordFailedAttempt(
          error,
          orderData,
          partnerType,
          existingPartners,
          eligiblePartners,
          attemptNumber
        );
      }

      throw error;
    }
  }

  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderData: T,
    partnerCode: string,
    eligiblePartners:EligiblePartnersData
  ): Promise<R> {

   this.logger.debug(`Creating Order with partner ${this.partnerCode}`);
    let existingPartners: any;
    let attemptNumber = 1;
    let partnerType = partnerCode;
    const startTime = Date.now();

    try {
      // Use the helper if available to handle partner tracking and selection
      // if (this.partnerHelper) {
      //   // Step 1: Load or store partner data
      //   existingPartners = await this.partnerHelper.loadOrStorePartners(
      //     orderData.awbNumber,
      //     eligiblePartners
      //   );

      //   // Step 2: Determine which partner to use
      //   partnerType = await this.partnerHelper.determinePartnerWithEligibility(
      //     orderData,
      //     eligiblePartners
      //   );

      //   // Make sure partnerCode in orderData matches the selected partner
      //   orderData.partnerCode = partnerType;

      //   // Step 3: Get current attempt number
      //   attemptNumber = this.partnerHelper.getAttemptNumber(
      //     existingPartners,
      //     partnerType
      //   );
      // }

      const endpointConfig = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.CREATE_ORDER,
        partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.CREATE_ORDER,
          orderData
        )
      ) {
        throw new Error("Invalid input data for CREATE_ORDER operation");
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.CREATE_ORDER,
        orderData,
        partnerCode,
        endpointConfig
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.CREATE_ORDER,
        response
      ) as R;

      // Calculate response time
      const responseTimeMs = Date.now() - startTime;

      // Record successful attempt if helper is available
      // if (this.partnerHelper) {
      //   await this.partnerHelper.recordSuccessfulAttempt(
      //     orderData.awbNumber,
      //     partnerType,
      //     existingPartners,
      //     eligiblePartners,
      //     attemptNumber,
      //     result,
      //     responseTimeMs,
      //     orderData
      //   );
      // }

      return result;
    } catch (error) {
      // Calculate response time for error tracking
      error.responseTimeMs = Date.now() - startTime;

      // Record failed attempt if helper is available
      // if (this.partnerHelper) {
      //   await this.partnerHelper.recordFailedAttempt(
      //     error,
      //     orderData,
      //     partnerType,
      //     existingPartners,
      //     eligiblePartners,
      //     attemptNumber
      //   );
      // }

      throw error;
    }
  }

    

    
  

  async createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(
      `Creating manifestation with partner ${this.partnerCode}`
    );
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.CREATE_MANIFEST,
        data.partnerCode
      );

      if (
        !this.validateInputForOperation(ENDPOINT_ID_ENUM.CREATE_MANIFEST, data)
      ) {
        throw new Error(
          "Invalid input data for create manifestation operation"
        );
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.CREATE_MANIFEST,
        data,
        data.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.CREATE_MANIFEST,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(`Manifest created successfully in ${responseTimeMs}ms`);

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      throw error;
    }
  }

  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    this.logger.debug(`Getting order details with partner ${this.partnerCode}`);
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.GET_ORDER_DETAILS,
        params.partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.GET_ORDER_DETAILS,
          params
        )
      ) {
        throw new Error("Invalid input data for get order operation");
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.GET_ORDER_DETAILS,
        params,
        params.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.GET_ORDER_DETAILS,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(
        `Order details retrieved successfully in ${responseTimeMs}ms`
      );

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      throw error;
    }
  }

  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(`Cancelling order with partner ${this.partnerCode}`);
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.CANCEL_ORDER,
        data.partnerCode
      );

      if (
        !this.validateInputForOperation(ENDPOINT_ID_ENUM.CANCEL_ORDER, data)
      ) {
        throw new Error("Invalid input data for cancel order operation");
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.CANCEL_ORDER,
        data,
        data.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.CANCEL_ORDER,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(`Order cancelled successfully in ${responseTimeMs}ms`);

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Push orders to DRS
   * @param orderData Order data for DRS payload creation
   * @returns DRS payload data
   */
  async pushOrderToDRS<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(
      `Pushing orders to DRS for ${data.order.awbNumber || "unknown"}`
    );
    const startTime = Date.now();
    // throw new Error("Not implemented");
    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_DRS,
        data.partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.PUSH_ORDER_TO_DRS,
          data.order
        )
      ) {
        throw new Error("Invalid input data for push orders to DRS operation");
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_DRS,
        data.order,
        data.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_DRS,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(
        `Orders pushed to DRS successfully in ${responseTimeMs}ms`
      );

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      this.logger.error(
        `Error pushing orders to DRS: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Push orders to PRS
   * @param data Data containing order IDs to push to PRS
   * @returns Response from PRS API
   */
  async pushOrdersToPRS<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(
      `Pushing orders to PRS: ${data.order.awbNumber || "unknown"}`
    );
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.PUSH_ORDERS_TO_PRS,
        data.partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.PUSH_ORDERS_TO_PRS,
          data.order
        )
      ) {
        throw new Error("Invalid input data for push orders to PRS operation");
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.PUSH_ORDERS_TO_PRS,
        data.order,
        data.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.PUSH_ORDERS_TO_PRS,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(
        `Orders pushed to PRS successfully in ${responseTimeMs}ms`
      );

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      this.logger.error(
        `Error pushing orders to PRS: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async pushOrderToTracking<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(
      `Pushing order to tracking with partner ${this.partnerCode}`
    );
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_TRACKING,
        data.partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.PUSH_ORDER_TO_TRACKING,
          data
        )
      ) {
        throw new Error(
          "Invalid input data for push order to tracking operation"
        );
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_TRACKING,
        data,
        data.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_TRACKING,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(
        `Order pushed to tracking successfully in ${responseTimeMs}ms`
      );

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      throw error;
    }
  }

  async manifestOrderToTracking<
    T extends StandardRequestDto,
    R extends BaseResDto,
  >(data: T): Promise<R> {
    this.logger.debug(
      `Manifesting order to tracking with partner ${data.partnerCode}`
    );
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.MANIFEST_ORDER_TO_TRACKING,
        data.partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.MANIFEST_ORDER_TO_TRACKING,
          data
        )
      ) {
        throw new Error(
          "Invalid input data for manifest order to tracking operation"
        );
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.MANIFEST_ORDER_TO_TRACKING,
        data,
        data.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.MANIFEST_ORDER_TO_TRACKING,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(
        `Order manifested to tracking successfully in ${responseTimeMs}ms`
      );

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Updates ecommerce order details with first mile hub information
   * @param data Order data with first mile hub details
   * @returns Response from ecom update API
   */
  async updateEcomOrderWebhook<
    T extends StandardRequestDto,
    R extends BaseResDto,
  >(data: T): Promise<R> {
    this.logger.debug(`Updating ecom order with partner ${this.partnerCode}`);
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.SELLER_ECOMM_WEBHOOK,
        data.partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.SELLER_ECOMM_WEBHOOK,
          data
        )
      ) {
        throw new Error("Invalid input data for update ecom order operation");
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.SELLER_ECOMM_WEBHOOK,
        data,
        data.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.SELLER_ECOMM_WEBHOOK,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(
        `Ecom order updated successfully in ${responseTimeMs}ms`
      );

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Push order data to HubOps system
   * @param data Order data for HubOps
   * @returns Response from HubOps API
   */
  async pushOrderToHubOps<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(
      `Pushing order to HubOps with partner ${this.partnerCode}`
    );
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_HUBOPS,
        data.partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.PUSH_ORDER_TO_HUBOPS,
          data
        )
      ) {
        throw new Error(
          "Invalid input data for push order to HubOps operation"
        );
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_HUBOPS,
        data,
        data.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.PUSH_ORDER_TO_HUBOPS,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(
        `Order pushed to HubOps successfully in ${responseTimeMs}ms`
      );

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Update order in HubOps system
   * @param data Order data for HubOps update
   * @returns Response from HubOps API
   */
  async updateOrderToHubOps<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(
      `Updating order in HubOps with partner ${this.partnerCode}`
    );
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.UPDATE_ORDER_TO_HUBOPS,
        data.partnerCode
      );

      if (
        !this.validateInputForOperation(
          ENDPOINT_ID_ENUM.UPDATE_ORDER_TO_HUBOPS,
          data
        )
      ) {
        throw new Error(
          "Invalid input data for update order to HubOps operation"
        );
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.UPDATE_ORDER_TO_HUBOPS,
        data,
        data.partnerCode,
        endpoint
      );

      const result = this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.UPDATE_ORDER_TO_HUBOPS,
        response
      ) as R;

      // Log successful operation with timing
      const responseTimeMs = Date.now() - startTime;
      this.logger.debug(
        `Order updated in HubOps successfully in ${responseTimeMs}ms`
      );

      return result;
    } catch (error) {
      // Add timing to error for tracking
      error.responseTimeMs = Date.now() - startTime;
      throw error;
    }
  }

  // TODO: Create response mapper object for specific partner
  // TODO: Log response message in a proper format
  // Private method for executing HTTP operations
  private async executeOperation(
    operation: string,
    data: any,
    partnerCode: string,
    endpointConfig: EndpointConfigModel
  ): Promise<any> {
    // Transform request body if needed
    let transformedData = data;

    try {
      // Get authentication headers
      const authHeaders = endpointConfig.requiresAuth
        ? await this.authProvider.getAuthHeaders()
        : {};

      // Process custom headers from configuration
      const customHeaders = {};
      if (endpointConfig.headerMapping) {
        for (const mapping of endpointConfig.headerMapping) {
          customHeaders[mapping.headerName] =
            data[mapping.sourceField] || mapping.defaultValue || "";
        }
      }

      // Combine all headers
      const requestHeaders = {
        ...(endpointConfig.contentType
          ? { "Content-Type": endpointConfig.contentType }
          : {}),
        ...authHeaders,
        ...customHeaders,
      };

      // Process URL parameters
      let url = endpointConfig.url;
      if (endpointConfig.urlParamMapping) {
        for (const mapping of endpointConfig.urlParamMapping) {
          const paramValue = data[mapping.sourceField];
          if (paramValue) {
            url = url.replace(
              `{${mapping.paramName}}`,
              encodeURIComponent(paramValue)
            );
          }
        }
      }

      // Process query parameters
      const queryParams = {};
      if (endpointConfig.queryParamMapping) {
        for (const mapping of endpointConfig.queryParamMapping) {
          const paramValue = data[mapping.sourceField];
          if (paramValue !== undefined) {
            queryParams[mapping.paramName] = paramValue;
          }
        }
      }

      // Transform request body if needed
      if (endpointConfig.payloadMapperConfig) {
        const mappingConfig =
          endpointConfig.payloadMapperConfig as unknown as SchemaMappingConfig;
        transformedData = this.schemaMapper.map(data, mappingConfig);
      }

      if (
        endpointConfig.partnerCode === PARTNER_CODE_ENUM.SMILE &&
        endpointConfig.endpointId === ENDPOINT_ID_ENUM.CREATE_ORDER &&
        transformedData[0]?.smileAwbNumber
      ) {
        transformedData[0].awbNumber = transformedData[0].smileAwbNumber;
        delete transformedData[0].smileAwbNumber;
      }

      this.logger.log(`(Transformed Data): ${JSON.stringify(transformedData)}`);
      this.logger.debug(`Request URL: ${url}`);

      let response;
      switch (endpointConfig.method.toLowerCase()) {
        case "get":
          response = await firstValueFrom(
            this.httpService.get(url, {
              headers: requestHeaders,
              params: queryParams,
            })
          );
          break;
        case "post":
          response = await firstValueFrom(
            this.httpService.post(url, transformedData, {
              headers: requestHeaders,
              params: queryParams,
            })
          );
          break;
        case "put":
          response = await firstValueFrom(
            this.httpService.put(url, transformedData, {
              headers: requestHeaders,
              params: queryParams,
            })
          );
          break;
        case "patch":
          response = await firstValueFrom(
            this.httpService.patch(url, transformedData, {
              headers: requestHeaders,
              params: queryParams,
            })
          );
          break;
        case "delete":
          response = await firstValueFrom(
            this.httpService.delete(url, {
              headers: requestHeaders,
              params: queryParams,
            })
          );
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${endpointConfig.method}`);
      }

      return response.data;
    } catch (error) {
      // Enhanced error handling logic
      if (error.isAxiosError) {
        // Extract as much information as possible from the error
        const errorResponse = error.response || {};
        const errorData = errorResponse.data || {};
        const errorStatus = errorResponse.status || error.status || 500;
        let errorMessage = "Unknown error occurred";

        // Try to extract a meaningful error message from various possible locations
        if (typeof errorData === "string") {
          errorMessage = errorData;
        } else if (
          errorData.message ||
          errorData.error ||
          errorData.description
        ) {
          errorMessage =
            errorData.message || errorData.error || errorData.description;
        } else if (
          errorData.errors &&
          Array.isArray(errorData.errors) &&
          errorData.errors.length > 0
        ) {
          errorMessage = errorData.errors.map((e) => e.message || e).join(", ");
        } else if (Object.keys(errorData).length > 0) {
          errorMessage = JSON.stringify(errorData);
        } else {
          errorMessage = error.message || "Request failed";
        }

        // Log detailed error information with clear formatting for easy identification
        this.logger.error(`API ERROR DETAILS:`);
        this.logger.error(`Status: [${errorStatus}]`);
        this.logger.error(`Message: ${errorMessage}`);
        this.logger.error(`Operation: ${operation}`);
        this.logger.error(`Partner: ${partnerCode}`);
        this.logger.error(`URL: ${error.config?.url}`);
        this.logger.error(`Method: ${error.config?.method}`);
        this.logger.error(
          `Request Data: ${JSON.stringify(transformedData, null, 2)}`
        );
        this.logger.error(
          `Response Data: ${JSON.stringify(errorData, null, 2)}`
        );

        // Throw a more informative custom exception with clearer error message
        throw new CustomHttpException(
          errorStatus,
          `API Error [${operation}]: ${errorMessage}`,
          errorData,
          {
            timestamp: new Date().toISOString(),
            operation,
            partnerCode: partnerCode,
            requestUrl: error.config?.url,
            requestMethod: error.config?.method,
            requestData: transformedData,
          },
          partnerCode
        );
      }

      // For non-Axios errors, improve logging and error message
      this.logger.error(
        `Non-Axios error in ${operation}: ${error.message}`,
        error.stack
      );
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Error during ${operation} operation: ${error.message}`,
        error,
        {
          timestamp: new Date().toISOString(),
          operation,
          partnerCode: partnerCode,
        },
        partnerCode
      );
    }
  }

  private async getEndpointConfig(
    endpointId: string,
    partnerCode: string
  ): Promise<EndpointConfigModel> {
    const endpoint = await this.endpointConfigRepository.getOne({
      partnerCode: partnerCode,
      endpointId: endpointId,
    });
    if (!endpoint) {
      throw new CustomHttpException(
        HttpStatus.NOT_FOUND,
        `Endpoint configuration not found for ${partnerCode} - ${endpointId}`
      );
    }
    return endpoint;
  }

  protected validateInputForOperation(operation: string, data: any): boolean {
    // Special validation for cancel orders - check for cAwbNumbers array instead of awbNumber
    if (operation === ENDPOINT_ID_ENUM.CANCEL_ORDER && data) {
      return (
        data.cAwbNumbers &&
        Array.isArray(data.cAwbNumbers) &&
        data.cAwbNumbers.length > 0
      );
    }

    // Special validation for push orders to PRS
    if (operation === ENDPOINT_ID_ENUM.PUSH_ORDERS_TO_PRS && data) {
      const isValid =
        data.awbNumbers &&
        Array.isArray(data.awbNumbers) &&
        data.awbNumbers.length > 0;
      if (!isValid) {
        this.logger.error(
          `Invalid input for ${operation}: awbNumbers must be a non-empty array`
        );
      }
      return isValid;
    }

    // Default validation for all other operations
    return true;
  }

  protected transformResponseForOperation(
    operation: string,
    response: any
  ): any {
    // If the response is already in BaseResDto format, return it as is
    if (
      response &&
      typeof response === "object" &&
      "statusCode" in response &&
      "message" in response &&
      "data" in response
    ) {
      return response;
    }

    // Otherwise, wrap it in a standardized BaseResDto format
    return this.createSuccessResponse(
      response,
      `${operation} operation completed successfully`
    );
  }

  protected createSuccessResponse<T extends BaseResDto>(
    data: any,
    message: string = "Operation successful"
  ): T {
    const successResponse = new BaseResDto() as T;
    // Use HTTP 200 as default success status code since the API response doesn't include status
    successResponse.statusCode = 200;
    successResponse.message = message;
    successResponse.data = data;
    successResponse.trace = {
      timestamp: new Date().toISOString(),
      partnerCode: this.partnerCode,
    };

    return successResponse;
  }
}
