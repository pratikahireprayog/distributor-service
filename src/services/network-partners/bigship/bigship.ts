import axios from 'axios';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NetworkPartner } from '../network-partner.abstract';
import { StatusTrackingLogsRepository } from 'src/common/repositories/status-tracking-logs/status-tracking-logs.repository';
import { StatusTrackingRepository } from 'src/common/repositories/status-tracking/status-tracking.repository';
import { HttpService } from '@nestjs/axios';
import { ResponseDto } from 'src/common/dtos/global.dto';
import { firstValueFrom, catchError } from 'rxjs';
import { STATUS_TRACKING_STATUS_ENUM } from 'src/common/enums/global.enum';
import { BigshipAuthService } from './bigship-auth.service';
import { BigshipEndPoints, fulfillmentEndPoints } from "./bigship.enum";

@Injectable()
export class BigshipService extends NetworkPartner {
    protected readonly baseUrl: string;
    protected readonly envUrl: string;
    private readonly SHIPMENT_DATA_ID = 2;

    constructor(
        private readonly bigshipAuthService: BigshipAuthService,
        private readonly statusTrackingLogsRepository: StatusTrackingLogsRepository,
        private readonly statusTrackingRepository: StatusTrackingRepository,
        private readonly httpService: HttpService,
        private readonly logger: Logger,
    ) {
        super();
        const baseUrl = process.env.BIGSHIP_BASE_URL;
        const envUrl = process.env.ENV_URL;
        if (!baseUrl) {
            this.logger.error('BIGSHIP_BASE_URL environment variable is not set');
            throw new Error('BIGSHIP_BASE_URL environment variable is not set');
        }
        this.baseUrl = baseUrl;
        this.envUrl = envUrl;
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

    async manifestOrder(request: any): Promise<ResponseDto> {
        this.logger.debug(`Manifesting order for systemOrderId: ${request.systemOrderId}`);
        const token = await this.getAuthToken();
        const manifestResponse = await this.makeManifestOrderRequest(request, token);
        this.logger.debug(`Manifest response received for systemOrderId: ${request.systemOrderId}`);
        return this.formatManifestResponse(manifestResponse);
    }

    private async makeManifestOrderRequest(request: any, token: string): Promise<any> {
        try {
            this.logger.debug(`Making manifest order request for systemOrderId: ${request.systemOrderId}`);
            const url = `${this.baseUrl}${BigshipEndPoints.MANIFEST_HEAVY_ENDPOINT}`;
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };
            const data = {
                system_order_id: request.systemOrderId,
                courier_id: request.courierId,
                risk_type: request.riskType
            };

            const response = await firstValueFrom(
                this.httpService.post(url, data, { headers }).pipe(
                    catchError(async (error) => {
                        this.logger.error(`Error in makeManifestOrderRequest: ${error.message}`, error.stack);
                        throw error;
                    })
                )
            );

            this.logger.debug(`Manifest API response: ${JSON.stringify(response.data)}`);
            await this.insertStatusTracking(request);

            if (response.data?.responseCode === 200 && response.data?.success === true) {
                await this.updateOrderStatus(request.awbNumber, "READY_FOR_DISPATCH");
                const shipmentData = await this.getShipmentData(1, request.systemOrderId.toString());
                await this.updateStatusTracking(shipmentData.data, request);
            }

            return response.data;
        } catch (error) {
            this.logger.error(`Error in makeManifestOrderRequest: ${error.message}`, error.stack);
            throw error;
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
                url: `${this.envUrl}${fulfillmentEndPoints.ORDER_FULFILLMENT}${awbNumber}`,
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
} 