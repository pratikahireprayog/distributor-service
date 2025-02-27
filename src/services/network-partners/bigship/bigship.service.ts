import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PartnerType } from '../../../common/enums/partner-type.enum';
import { PartnerEndpoint } from '../../../common/interfaces/partner-endpoint.interface';
import { BaseNetworkPartnerActivity } from '../base/base-network-partner-activity';
import { BigshipAuthService } from './bigship-auth.service';
import { BigshipEndPoints } from './bigship.enum';

/**
 * Service for interacting with Bigship API
 */
@Injectable()
export class BigshipService extends BaseNetworkPartnerActivity {
    private readonly baseUrl: string;

    /**
     * Constructor for BigshipService
     * @param authProvider The authentication provider
     * @param httpService The HTTP service
     * @param configService The configuration service
     */
    constructor(
        private readonly bigshipAuthService: BigshipAuthService,
        httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        super(PartnerType.BIGSHIP, bigshipAuthService, httpService);
        this.baseUrl = this.configService.get<string>('BIGSHIP_BASE_URL');

        if (!this.baseUrl) {
            this.logger.error('BIGSHIP_BASE_URL environment variable is not set');
            throw new Error('BIGSHIP_BASE_URL environment variable is not set');
        }
    }

    async createManifest(manifestationDetails: BigshipOrderManifestationDetails): Promise<any> {
        return "Manifestation details";
    }

    /**
     * Gets the endpoint for creating a shipment
     * @returns The endpoint
     */
    protected getCreateManifestationEndpoint(): PartnerEndpoint {
        return {
            url: `${this.baseUrl}${BigshipEndPoints.MANIFEST_HEAVY_ENDPOINT}`,
            method: 'POST',
            requiresAuth: true,
            contentType: 'application/json',
        };
    }

    /**
     * Gets the endpoint for tracking a shipment
     * @param trackingId The tracking ID
     * @returns The endpoint
     */
    protected getTrackOrderEndpoint(trackingId: string): PartnerEndpoint {
        return {
            url: `${this.baseUrl}${BigshipEndPoints.TRACKING_ENDPOINT}?awbNumber=${trackingId}`,
            method: 'GET',
            requiresAuth: true,
        };
    }

    /**
     * Gets the endpoint for cancelling a shipment
     * @param shipmentId The shipment ID
     * @returns The endpoint
     */
    protected getCancelOrderEndpoint(orderId: string): PartnerEndpoint {
        return {
            url: `${this.baseUrl}${BigshipEndPoints.CANCEL_ORDER_ENDPOINT}/${orderId}`,
            method: 'POST',
            requiresAuth: true,
            contentType: 'application/json',
        };
    }

    /**
     * Transforms the input data for the create shipment operation
     * @param data The input data
     * @returns The transformed data
     */
    protected validateInputForOperation(operation: string, data: any): boolean {
        if (operation === 'createShipment') {
            // Validate required fields for shipment creation
            if (!data.systemOrderId) {
                this.logger.error('Missing required field: systemOrderId');
                return false;
            }

            if (!data.delivery || !data.delivery.pincode) {
                this.logger.error('Missing required field: delivery.pincode');
                return false;
            }
        }

        return true;
    }

    /**
     * Transforms the response from the create shipment operation
     * @param response The response from the API
     * @returns The transformed response
     */
    protected transformResponseForOperation(operation: string, response: any): any {
        if (operation === 'createShipment') {
            return {
                success: true,
                trackingId: response.awbNumber,
                partnerOrderId: response.partnerOrderId,
                partnerName: PartnerType.BIGSHIP,
                message: 'Order created successfully',
                data: response,
            };
        } else if (operation === 'trackShipment') {
            return {
                trackingId: response.awbNumber,
                status: response.status,
                statusDescription: response.statusDescription,
                currentLocation: response.currentLocation,
                events: response.events?.map(event => ({
                    timestamp: event.timestamp,
                    status: event.status,
                    location: event.location,
                    description: event.description
                })) || [],
            };
        } else if (operation === 'cancelShipment') {
            return {
                success: true,
                trackingId: response.awbNumber,
                message: 'Order cancelled successfully',
                data: response,
            };
        }

        return response;
    }

    /**
     * Gets additional headers for API requests
     * @returns Additional headers
     */
    protected getAdditionalHeaders(): Record<string, string> {
        return {
            'X-Source': 'delivery-orchestrator',
        };
    }
} 