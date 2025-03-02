import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, HttpException, HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { SchemaMapperService } from '@robinydv/schema-mapper';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { PartnerEndpoint } from 'src/services/network-partners/interfaces/partner-endpoint.interface';
import { BigshipAuthService } from './bigship-auth.service';
import { BigshipEndPoints, FulfillmentEndPoints } from './bigship.enum';
import { STATUS_TRACKING_STATUS_ENUM } from 'src/common/enums/global.enum';
import { StatusTrackingRepository } from 'src/common/repositories/status-tracking/status-tracking.repository';
import { StatusTrackingLogsRepository } from 'src/common/repositories/status-tracking-logs/status-tracking-logs.repository';
import { BaseManifestReqDto, BaseManifestResDto } from 'src/common/dtos/base.dto';
import { BigshipManifestReqDto, BigshipManifestResDto, ShipmentDataResDto } from './bigship.dto';
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

    async createManifest<T extends BaseManifestReqDto, R extends BaseManifestResDto>(manifestationDetails: T): Promise<R> {
        try {
            // This will call the base class implementation which will use our concrete methods
            const response = await super.createManifest<T, R>(manifestationDetails);

            // Additional post-processing specific to Bigship
            // Type assertion for BigShip-specific response properties
            const manifestationData = manifestationDetails as unknown as BigshipManifestReqDto;
            const bigshipResponse = response as unknown as BigshipManifestResDto;

            this.logger.debug(`Manifest API response: ${JSON.stringify(bigshipResponse)}`);
            await this.insertStatusTracking(manifestationData);

            if (bigshipResponse && bigshipResponse.responseCode === 200 && bigshipResponse.success === true) {
                try {
                    await this.updateOrderStatus(manifestationData.awbNumber, "READY_FOR_DISPATCH");
                } catch (error) {
                    this.logger.error(`Error updating order status: ${error.message}`);
                }
                const shipmentData = await this.getShipmentData(1, manifestationData.systemOrderId.toString());
                await this.updateStatusTracking(shipmentData.data, manifestationData);
                return this.formatManifestResponse(bigshipResponse) as R;
            } else if (bigshipResponse && bigshipResponse.responseCode === 200 && bigshipResponse.success === false) {
                return this.formatManifestResponse(bigshipResponse) as R;
            } else if (bigshipResponse && bigshipResponse.responseCode === 0) {
                this.handleManifestError(response);
            } else {
                // Handle case where bigshipResponse is null or undefined
                this.logger.error('Received null or invalid response from Bigship API');
                return this.formatManifestResponse(null) as R;
            }

            // Default fallback response if none of the conditions above return
            return this.formatManifestResponse({
                responseCode: 500,
                success: false,
                message: 'Failed to get valid response from Bigship API'
            }) as R;
        } catch (error) {
            this.logger.error(`Error in createManifest: ${error.message}`, error.stack);
            throw error; // Let the error propagate to be handled by the caller
        }
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

    private async handleManifestError(error: any): Promise<void> {
        // Create a safe error object without circular references
        const safeError = {
            errorType: error?.constructor?.name,
            message: error?.message,
            responseCode: error?.responseCode,
            responseData: error?.response?.data,
            status: error?.response?.status,
            lineNumber: error?.stack?.split('\n')[1]?.match(/\d+/)?.[0],
            methodName: error?.stack?.split('\n')[1]?.match(/at\s+(\w+)/)?.[1]
        };

        // Log the safe error object
        this.logger.error('Manifest Error Details:', safeError);

        // Handle specific error cases
        if (error instanceof HttpException) {
            throw error;
        }

        const errorResponse = {
            data: null,
            success: false,
            message: error?.message || 'Failed to manifest order',
            statusCode: 422
        };

        if (error?.responseCode === 0) {
            this.logger.debug('Response code 0 detected');
            throw new HttpException(errorResponse, HttpStatus.UNPROCESSABLE_ENTITY);
        }

        // Handle null or undefined responseCode
        if (error?.responseCode === null || error?.responseCode === undefined) {
            this.logger.debug('Null or undefined response code detected');
            throw new HttpException(errorResponse, HttpStatus.UNPROCESSABLE_ENTITY);
        }

        // Default error handling
        throw new HttpException(
            errorResponse,
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
    }

    private formatManifestResponse(responseData: any): BaseManifestResDto {
        // Handle null or undefined responseData
        if (!responseData) {
            return {
                statusCode: false,
                message: 'Failed to get valid response from Bigship API',
                data: null
            } as BaseManifestResDto;
        }

        // Convert the Bigship response format to the base response format
        return {
            statusCode: responseData.responseCode === 200 && responseData.success === true,
            message: responseData.message || 'No message provided',
            data: responseData.data || responseData
        } as BaseManifestResDto;
    }

    private async getShipmentData(shipmentDataId: number, systemOrderId: string): Promise<ShipmentDataResDto> {
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
            return response.data as ShipmentDataResDto;
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