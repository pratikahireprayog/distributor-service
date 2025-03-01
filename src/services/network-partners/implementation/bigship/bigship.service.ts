import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SchemaMapperService } from '@robinydv/schema-mapper';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { PartnerEndpoint } from 'src/services/network-partners/interfaces/partner-endpoint.interface';
import { BigshipAuthService } from './bigship-auth.service';
import { BigshipEndPoints, FulfillmentEndPoints } from './bigship.enum';
import { STATUS_TRACKING_STATUS_ENUM } from 'src/common/enums/global.enum';
import { StatusTrackingRepository } from 'src/common/repositories/status-tracking/status-tracking.repository';
import { StatusTrackingLogsRepository } from 'src/common/repositories/status-tracking-logs/status-tracking-logs.repository';
import { ResponseDto } from 'src/common/dtos/global.dto';
import { BaseManifestDto, BaseManifestResponse, BigshipManifestDto, BigshipManifestResponse } from 'src/common/dtos/manifest.dto';
import { EndpointConfigRepository } from 'src/common/repositories/endpoint-configs/endpoint-configs.repository';
import { BaseNetworkPartner } from '../../base/base-network-partner.abstract';
/**
 * Service for interacting with Bigship API
 */
@Injectable()
export class BigshipService extends BaseNetworkPartner {
    private readonly baseUrl: string;
    private readonly envUrl: string;
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
        private readonly statusTrackingRepository: StatusTrackingRepository,
        private readonly statusTrackingLogsRepository: StatusTrackingLogsRepository,
        protected readonly endpointConfigRepository: EndpointConfigRepository,
        protected readonly schemaMapper: SchemaMapperService<any, any>,
    ) {
        super(PARTNER_CODE_ENUM.BIGSHIP, bigshipAuthService, httpService, endpointConfigRepository, schemaMapper);
        this.baseUrl = this.configService.get<string>('BIGSHIP_BASE_URL');
        this.envUrl = this.configService.get<string>('ENV_URL');

        if (!this.baseUrl) {
            this.logger.error('BIGSHIP_BASE_URL environment variable is not set');
            throw new Error('BIGSHIP_BASE_URL environment variable is not set');
        }
    }

    private async getAuthToken(): Promise<string> {
        const token = await this.bigshipAuthService.getToken();
        if (!token) {
            throw new HttpException(
                'Failed to retrieve authentication token',
                HttpStatus.UNAUTHORIZED
            );
        }
        return token;
    }

    async createManifest<T extends BaseManifestDto, R extends BaseManifestResponse>(manifestationDetails: T): Promise<R> {
        // This will call the base class implementation which will use our concrete methods
        const response = await super.createManifest<T, R>(manifestationDetails);

        // Additional post-processing specific to Bigship
        // Type assertion for BigShip-specific response properties
        const bigshipResponse = response as unknown as BigshipManifestResponse;
        if (bigshipResponse?.responseCode === 200 && bigshipResponse?.success === true) {
            await this.updateOrderStatus(manifestationDetails.awbNumber, "READY_FOR_DISPATCH");
            const shipmentData = await this.getShipmentData(1, manifestationDetails.systemOrderId.toString());
            await this.updateStatusTracking(shipmentData.data, manifestationDetails);
        }

        return response;
    }

    private async insertStatusTracking(request: any): Promise<void> {
        try {
            if (!request) {
                throw new HttpException(
                    'Missing required data for status tracking',
                    HttpStatus.BAD_REQUEST
                );
            }
            const statusTrackingData = {
                systemOrderId: request.systemOrderId,
                awbNumber: request.awbNumber,
                status: STATUS_TRACKING_STATUS_ENUM.MANIFESTED,
                statusUpdatedDate: new Date(),
                pushedTo: 'BIGSHIP',
                courierId: request.courierId,
            };

            await this.statusTrackingRepository.updateOne(
                { systemOrderId: request.systemOrderId, awbNumber: request.awbNumber },
                { $set: statusTrackingData },
                { upsert: true }
            );
            await this.statusTrackingLogsRepository.updateOne(
                { systemOrderId: request.systemOrderId, awbNumber: request.awbNumber },
                { $set: statusTrackingData },
                { upsert: true }
            );
        } catch (error) {
            this.logger.error('Error in insertStatusTracking:', error);
            throw error;
        }
    }

    private async updateOrderStatus(awbNumber: string, orderStatus: string = "READY_FOR_DISPATCH"): Promise<void> {
        try {
            const data = JSON.stringify({ orderStatus });
            const config = {
                method: 'patch',
                maxBodyLength: Infinity,
                url: `${this.envUrl}${FulfillmentEndPoints.ORDER_FULFILLMENT}${awbNumber}`,
                headers: {
                    'accept': '*/*',
                    'Content-Type': 'application/json'
                },
                data: data
            };

            await axios.request(config);
        } catch (error) {
            this.logger.error(`Error in updateOrderStatus for AWB ${awbNumber}:`, error);
            throw error;
        }
    }

    private async updateStatusTracking(data: any, request: any): Promise<void> {
        try {
            if (!data) {
                throw new HttpException(
                    'Missing required data for status tracking update',
                    HttpStatus.BAD_REQUEST
                );
            }

            const statusTrackingData = {
                carrierTrackingId: data.master_awb,
                lrNumber: data?.lr_number || "",
                courierName: data.courier_name,
                trackingType: data?.master_awb ? "awb" : "lrn",
            };

            await this.statusTrackingRepository.updateOne(
                { systemOrderId: request.systemOrderId, awbNumber: request.awbNumber },
                { $set: statusTrackingData }
            );
            await this.statusTrackingLogsRepository.updateMany(
                { systemOrderId: request.systemOrderId, awbNumber: request.awbNumber },
                { $set: statusTrackingData }
            );
        } catch (error) {
            this.logger.error('Error in updateStatusTracking:', error);
            throw error;
        }
    }

    private formatManifestResponse(responseData: any): ResponseDto {
        return {
            statusCode: responseData.responseCode,
            message: responseData.message,
            data: responseData.data
        };
    }

    private async getShipmentData(shipmentDataId: number, systemOrderId: string): Promise<any> {
        try {
            if (![1, 2, 3].includes(shipmentDataId)) {
                throw new HttpException(
                    'Invalid shipment_data_id. Must be 1, 2, or 3',
                    HttpStatus.BAD_REQUEST
                );
            }

            const token = await this.getAuthToken();
            const config = {
                method: 'post',
                url: `${this.baseUrl}${BigshipEndPoints.SHIPMENT_DATA_ENDPOINT}`,
                params: {
                    shipment_data_id: shipmentDataId,
                    system_order_id: systemOrderId
                },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            const response = await axios.request(config);
            return response.data;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data || 'Failed to fetch shipment data',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
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
                partnerName: PARTNER_CODE_ENUM.BIGSHIP,
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