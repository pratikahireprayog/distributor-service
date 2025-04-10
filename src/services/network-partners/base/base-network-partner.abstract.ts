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
} from "src/common/dtos/base.dto";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { BaseNetworkPartnerHelper } from "./base-network-partner-helper.service";
import { EligiblePartnersData } from "src/common/dtos/global.dto";

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
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.debug(`Creating Order with partner ${this.partnerCode}`);
    let existingPartners: any;
    let attemptNumber = 1;
    let partnerType: PARTNER_CODE_ENUM = this.partnerCode;
    const startTime = Date.now();

    try {
      // Use the helper if available to handle partner tracking and selection
      if (this.partnerHelper) {
        // Step 1: Load or store partner data
        existingPartners = await this.partnerHelper.loadOrStorePartners(
          orderData.awbNumber,
          eligiblePartners
        );

        // Step 2: Determine which partner to use
        partnerType = await this.partnerHelper.determinePartnerWithEligibility(
          orderData,
          eligiblePartners
        );

        // Make sure partnerCode in orderData matches the selected partner
        orderData.partnerCode = partnerType;

        // Step 3: Get current attempt number
        attemptNumber = this.partnerHelper.getAttemptNumber(
          existingPartners,
          partnerType
        );
      }

      const endpointConfig = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.CREATE_ORDER
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

  async createManifest<T extends BaseReqDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(
      `Creating manifestation with partner ${this.partnerCode}`
    );
    const startTime = Date.now();

    try {
      const endpoint = await this.getEndpointConfig(
        ENDPOINT_ID_ENUM.CREATE_MANIFEST
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
        ENDPOINT_ID_ENUM.GET_ORDER_DETAILS
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
        ENDPOINT_ID_ENUM.CANCEL_ORDER
      );

      if (
        !this.validateInputForOperation(ENDPOINT_ID_ENUM.CANCEL_ORDER, data)
      ) {
        throw new Error("Invalid input data for cancel order operation");
      }

      const response = await this.executeOperation(
        ENDPOINT_ID_ENUM.CANCEL_ORDER,
        data,
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

  // TODO: Create response mapper object for specific partner
  // TODO: Log response message in a proper format
  // Private method for executing HTTP operations
  private async executeOperation(
    operation: string,
    data: any,
    endpointConfig: EndpointConfigModel
  ): Promise<any> {
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
      let transformedData = data;
      if (endpointConfig.payloadMapperConfig) {
        const mappingConfig =
          endpointConfig.payloadMapperConfig as unknown as SchemaMappingConfig;
        transformedData = this.schemaMapper.map(data, mappingConfig);
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
      // Error handling logic
      if (error.isAxiosError) {
        error.context = {
          operation,
          partnerCode: this.partnerCode,
          // requestData: data
        };
      }
      throw error;
    }
  }

  private async getEndpointConfig(
    endpointId: string
  ): Promise<EndpointConfigModel> {
    const endpoint = await this.endpointConfigRepository.getOne({
      partnerCode: this.partnerCode,
      endpointId: endpointId,
    });
    if (!endpoint) {
      throw new CustomHttpException(
        HttpStatus.NOT_FOUND,
        `Endpoint configuration not found for ${this.partnerCode} - ${endpointId}`
      );
    }
    return endpoint;
  }

  protected validateInputForOperation(operation: string, data: any): boolean {
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
