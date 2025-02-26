import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { PartnerType } from '../../../common/enums/partner-type.enum';
import { AuthProvider } from '../../../common/interfaces/auth-provider.interface';
import { INetworkPartnerActivity } from '../../../common/interfaces/network-partner-activity.interface';
import { PartnerEndpoint } from '../../../common/interfaces/partner-endpoint.interface';

/**
 * Base abstract class for network partner activities
 * Implements common functionality for all network partners
 */
export abstract class BaseNetworkPartnerActivity implements INetworkPartnerActivity {
    protected readonly logger: Logger;

    /**
     * Constructor for BaseNetworkPartnerActivity
     * @param partnerId The partner type
     * @param authProvider The authentication provider
     * @param httpService The HTTP service for making API requests
     */
    constructor(
        protected readonly partnerId: PartnerType,
        protected readonly authProvider: AuthProvider,
        protected readonly httpService: HttpService,
    ) {
        this.logger = new Logger(this.constructor.name);
    }

    /**
     * Creates a shipment with the network partner
     * @param data The shipment data
     */
    async createShipment(data: any): Promise<any> {
        this.logger.debug(`Creating shipment with partner ${this.partnerId}`);
        const endpoint = this.getCreateShipmentEndpoint();

        try {
            if (!this.validateInputForOperation('createShipment', data)) {
                throw new Error('Invalid input data for create shipment operation');
            }

            const response = await this.executeOperation('createShipment', data, endpoint);
            return this.transformResponseForOperation('createShipment', response);
        } catch (error) {
            this.handleError(error, `${this.partnerId}:createShipment`);
        }
    }

    /**
     * Tracks a shipment using the network partner's API
     * @param trackingId The tracking ID to track
     */
    async trackShipment(trackingId: string): Promise<any> {
        this.logger.debug(`Tracking shipment ${trackingId} with partner ${this.partnerId}`);
        const endpoint = this.getTrackShipmentEndpoint(trackingId);

        try {
            const response = await this.executeOperation('trackShipment', {}, endpoint);
            return this.transformResponseForOperation('trackShipment', response);
        } catch (error) {
            this.handleError(error, `${this.partnerId}:trackShipment`);
        }
    }

    /**
     * Cancels a shipment with the network partner
     * @param shipmentId The shipment ID to cancel
     */
    async cancelShipment(shipmentId: string): Promise<any> {
        this.logger.debug(`Cancelling shipment ${shipmentId} with partner ${this.partnerId}`);
        const endpoint = this.getCancelShipmentEndpoint(shipmentId);

        try {
            const response = await this.executeOperation('cancelShipment', {}, endpoint);
            return this.transformResponseForOperation('cancelShipment', response);
        } catch (error) {
            this.handleError(error, `${this.partnerId}:cancelShipment`);
        }
    }

    // Template methods to be implemented by concrete classes
    protected abstract getCreateShipmentEndpoint(): PartnerEndpoint;
    protected abstract getTrackShipmentEndpoint(trackingId: string): PartnerEndpoint;
    protected abstract getCancelShipmentEndpoint(shipmentId: string): PartnerEndpoint;

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
        endpoint: PartnerEndpoint
    ): Promise<any> {
        try {
            const headers = endpoint.requiresAuth
                ? await this.authProvider.getAuthHeaders()
                : {};

            const requestHeaders = {
                ...(endpoint.contentType ? { 'Content-Type': endpoint.contentType } : {}),
                ...this.getAdditionalHeaders(),
                ...headers,
            };

            let response;
            switch (endpoint.method.toLowerCase()) {
                case 'get':
                    response = await firstValueFrom(
                        this.httpService.get(endpoint.url, { headers: requestHeaders })
                    );
                    break;
                case 'post':
                    response = await firstValueFrom(
                        this.httpService.post(endpoint.url, data, { headers: requestHeaders })
                    );
                    break;
                case 'put':
                    response = await firstValueFrom(
                        this.httpService.put(endpoint.url, data, { headers: requestHeaders })
                    );
                    break;
                case 'delete':
                    response = await firstValueFrom(
                        this.httpService.delete(endpoint.url, { headers: requestHeaders })
                    );
                    break;
                default:
                    throw new Error(`Unsupported HTTP method: ${endpoint.method}`);
            }

            return response.data;
        } catch (error) {
            this.handleError(error, `${this.partnerId}:${operation}`);
        }
    }
} 