import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { SchemaMapperService } from '@robinydv/schema-mapper';
import { AuthProvider } from '../interfaces/auth-provider.interface';
import { INetworkPartner } from '../interfaces/network-partner.interface';
import { PartnerEndpoint } from '../interfaces/partner-endpoint.interface';
import { EndpointConfigModel } from 'src/common/repositories/endpoint-configs/endpoint-configs.schema';
import { EndpointConfigRepository } from 'src/common/repositories/endpoint-configs/endpoint-configs.repository';
import { ENDPOINT_ID_ENUM, PARTNER_CODE_ENUM } from 'src/common/enums';

/**
 * Base abstract class for network partner activities
 * Implements common functionality for all network partners
 */
export abstract class BaseNetworkPartner implements INetworkPartner {
    protected readonly logger: Logger;

    /**
     * Constructor for BaseNetworkPartnerActivity
     * @param partnerCode The partner code
     * @param authProvider The authentication provider
     * @param httpService The HTTP service for making API requests
     */
    constructor(
        protected readonly partnerCode: PARTNER_CODE_ENUM,
        protected readonly authProvider: AuthProvider,
        protected readonly httpService: HttpService,
        protected readonly endpointConfigRepository: EndpointConfigRepository,
        protected readonly schemaMapper: SchemaMapperService<any, any>,
    ) {
        this.logger = new Logger(this.constructor.name);
    }

    /**
     * Creates a shipment with the network partner
     * @param data The shipment data
     */
    async createManifest(data: any): Promise<any> {
        this.logger.debug(`Creating manifestation with partner ${this.partnerCode}`);
        const endpoint = await this.getEndpointConfig(ENDPOINT_ID_ENUM.CREATE_MANIFEST);

        try {
            if (!this.validateInputForOperation(ENDPOINT_ID_ENUM.CREATE_MANIFEST, data)) {
                throw new Error('Invalid input data for create manifestation operation');
            }

            const response = await this.executeOperation(ENDPOINT_ID_ENUM.CREATE_MANIFEST, data, endpoint);
            return this.transformResponseForOperation(ENDPOINT_ID_ENUM.CREATE_MANIFEST, response);
        } catch (error) {
            this.handleError(error, `${this.partnerCode}:createManifest`);
        }
    }

    async getEndpointConfig(endpointId: string): Promise<EndpointConfigModel> {
        const endpoint = await this.endpointConfigRepository.getOne({ partnerCode: this.partnerCode, endpointId: endpointId });
        return endpoint;
    }

    //     this.logger.debug(`Cancelling order ${orderId} with partner ${this.partnerId}`);
    //     const endpoint = this.getCancelOrderEndpoint(orderId);

    //     try {
    //         const response = await this.executeOperation('cancelOrder', {}, endpoint);
    //         return this.transformResponseForOperation('cancelOrder', response);
    //     } catch (error) {
    //         this.handleError(error, `${this.partnerId}:cancelOrder`);
    //     }
    // }

    // Template methods to be implemented by concrete classes
    protected abstract getTrackOrderEndpoint(trackingId: string): PartnerEndpoint;
    protected abstract getCancelOrderEndpoint(orderId: string): PartnerEndpoint;

    // Optional methods with default implementations
    protected validateInputForOperation(operation: string, data: any): boolean {
        return true;
    }

    protected transformResponseForOperation(operation: string, response: any): any {
        return response;
    }

    protected getAdditionalHeaders(): Record<string, string> {
        return {};
    }

    protected handleError(error: any, context: string): never {
        this.logger.error(`Error in ${context}: ${error.message}`, error.stack);
        throw error;
    }

    // Private method for executing HTTP operations
    private async executeOperation(
        operation: string,
        data: any,
        endpointConfig: EndpointConfigModel
    ): Promise<any> {
        try {
            const headers = endpointConfig.requiresAuth
                ? await this.authProvider.getAuthHeaders()
                : {};

            const requestHeaders = {
                ...(endpointConfig.contentType ? { 'Content-Type': endpointConfig.contentType } : {}),
                ...this.getAdditionalHeaders(),
                ...headers,
            };

            // Transform the payload if mapping config exists
            const transformedData = endpointConfig.payloadMapperConfig
                ? this.schemaMapper.map(data, endpointConfig.payloadMapperConfig)
                : data;

            let response;
            switch (endpointConfig.method.toLowerCase()) {
                case 'get':
                    response = await firstValueFrom(
                        this.httpService.get(endpointConfig.url, { headers: requestHeaders })
                    );
                    break;
                case 'post':
                    response = await firstValueFrom(
                        this.httpService.post(endpointConfig.url, transformedData, { headers: requestHeaders })
                    );
                    break;
                case 'put':
                    response = await firstValueFrom(
                        this.httpService.put(endpointConfig.url, transformedData, { headers: requestHeaders })
                    );
                    break;
                case 'delete':
                    response = await firstValueFrom(
                        this.httpService.delete(endpointConfig.url, { headers: requestHeaders })
                    );
                    break;
                default:
                    throw new Error(`Unsupported HTTP method: ${endpointConfig.method}`);
            }

            return response.data;
        } catch (error) {
            this.handleError(error, `executeOperation: partnerCode: ${this.partnerCode} | operation :${operation} | data: ${JSON.stringify(data)}`);
        }
    }
} 