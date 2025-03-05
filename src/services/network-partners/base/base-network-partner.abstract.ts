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
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderData: T
  ): Promise<R> {
    this.logger.debug(`Creating Order with partner ${this.partnerCode}`);
    const endpointConfig = await this.getEndpointConfig(
      ENDPOINT_ID_ENUM.CREATE_ORDER
    );

    try {
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
      return this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.CREATE_ORDER,
        response
      ) as R;
    } catch (error) {
      throw error;
    }
  }

  async createManifest<T extends BaseReqDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(
      `Creating manifestation with partner ${this.partnerCode}`
    );
    const endpoint = await this.getEndpointConfig(
      ENDPOINT_ID_ENUM.CREATE_MANIFEST
    );

    try {
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
      return this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.CREATE_MANIFEST,
        response
      ) as R;
    } catch (error) {
      throw error;
    }
  }

  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    this.logger.debug(`Getting order details with partner ${this.partnerCode}`);
    const endpoint = await this.getEndpointConfig(
      ENDPOINT_ID_ENUM.GET_ORDER_DETAILS
    );

    try {
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
      return this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.GET_ORDER_DETAILS,
        response
      ) as R;
    } catch (error) {
      throw error;
    }
  }

  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(`Cancelling order with partner ${this.partnerCode}`);
    const endpoint = await this.getEndpointConfig(
      ENDPOINT_ID_ENUM.CANCEL_ORDER
    );

    try {
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
      return this.transformResponseForOperation(
        ENDPOINT_ID_ENUM.CANCEL_ORDER,
        response
      ) as R;
    } catch (error) {
      throw error;
    }
  }

  // TODO: Create response mapper object for specific partner
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
