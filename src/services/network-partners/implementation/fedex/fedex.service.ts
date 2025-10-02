import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { BaseOrderResDto, BaseReqDto, BaseResDto } from "src/common/dtos/base.dto";
import { BaseCancelOrderDtoV2, BaseOrderReqDtoV2 } from "src/common/dtos/base2.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { ACCOUNT_DETAILS, FEDEX_URLS, PACKAGING_TYPES } from "./fedex-constants";
import { FEDEXAuthService } from "./fedex-auth.service";

@Injectable()
export class FEDEXService extends BaseNetworkPartner {
    protected readonly logger = new Logger(FEDEXService.name);
    private readonly httpsAgent: https.Agent;

    constructor(
        protected readonly httpService: HttpService,
        private readonly configService: ConfigService,
        protected readonly authProvider: FEDEXAuthService,
        protected readonly endpointConfigRepository: EndpointConfigRepository,
        protected readonly schemaMapper: SchemaMapperService<any, any>
    ) {
        super(PARTNER_CODE_ENUM.FEDEX, null, httpService, endpointConfigRepository, schemaMapper);

        this.httpsAgent = new https.Agent({
            keepAlive: true,
            maxSockets: 50,
            timeout: 60000,
        });
    }

    /**
     * Create an order with FedEx (Consolidation + Shipment)
     */
    async createOrderV2<T extends BaseOrderReqDtoV2, R extends any>(
        orderDetails: T,
        partnerCode: string,
        eligiblePartners?: EligiblePartnersData
    ): Promise<R> {
        const fedexBaseUrl = this.configService.get<string>("FEDEX_BASE_URL");

        try {

            // 1. Transform payload for consolidation
            const fedexShipment = await this.transformToFedexShipment(orderDetails);

            // 2. Create Consolidation

            console.log("FEDEX_URLS.fedexShipment", FEDEX_URLS.CREATE_SHIPMENT);
            console.dir(JSON.stringify(fedexShipment), null);

            const response = await this.callFedexPOSTAPI(
                FEDEX_URLS.CREATE_SHIPMENT,
                fedexShipment
            );
            console.log("FEDEX_URLS.fedexShipment response response", response);


            // 5. Format and return
            return response.data;

        } catch (error) {
            this.logger.error(`FEDEX createOrder error: ${JSON.stringify(error)}`);
            return {
                statusCode: error.status || error.response?.status || 500,
                message: `FEDEX createOrder failed: ${error.message || "Unknown error"}`,
                data: {
                    originalResponse: error.response?.data || null,
                    requestUrl: (error as any).requestUrl || "unknown",
                    requestBody: (error as any).requestBody || null,
                },
                trace: {
                    timestamp: new Date().toISOString(),
                    partnerCode: this.partnerCode,
                },
            } as any;
        }
    }

    // ----------------------
    // 2. Transform Order Payload to FedEx Shipment
    // ----------------------
    private async transformToFedexShipment(order: any) {
        const shipperAddress = order.addresses.find(a => a.type === 'PICKUP');
        const recipientAddress = order.addresses.find(a => a.type === 'DELIVERY');
        const item = order.parentShipment.items[0];
        const account = this.getAccountNumberForFedex('Mumbai', 'FEDEX (IMP)');

        const shipperCountryCode = await this.fetchAndValidateCountryCode(
            shipperAddress.zip || shipperAddress.postalCode || ""
        );
        const receiverCountryCode = await this.fetchAndValidateCountryCode(
            recipientAddress.zip || recipientAddress.postalCode || ""
        );
        return {
            includeBase64document: false,
            openShipmentAction: 'CONFIRM',
            customerTransactionId: `ORDER-${order.orderId}`,
            accountNumber: {
                value: this.configService.get<string>('FEDEX_ACCOUNT_NUMBER'),
            },
            labelResponseOptions: "URL_ONLY",
            requestedShipment: {
                serviceType: this.mapServiceType(order.serviceType),
                shipper: {
                    contact: {
                        personName: shipperAddress.name,
                        phoneNumber: shipperAddress.phone,
                        emailAddress: shipperAddress.email || '',
                        companyName: shipperAddress.companyName || 'SENDER COMPANY',
                    },
                    address: {
                        streetLines: [shipperAddress.street],
                        city: shipperAddress.city,
                        postalCode: shipperAddress.zip,
                        stateOrProvinceCode: shipperAddress.state || '',
                        countryCode: shipperCountryCode,
                        residential: false,
                    },
                },
                recipients: [
                    {
                        contact: {
                            personName: recipientAddress.name,
                            phoneNumber: recipientAddress.phone,
                            emailAddress: recipientAddress.email || '',
                            companyName: recipientAddress.companyName || 'RECIPIENT COMPANY',
                        },
                        address: {
                            streetLines: [recipientAddress.street],
                            city: recipientAddress.city,
                            postalCode: recipientAddress.zip,
                            stateOrProvinceCode: recipientAddress.state || '',
                            countryCode: receiverCountryCode,
                            residential: false,
                        },
                    },
                ],
                shippingChargesPayment: {
                    payor: {
                        responsibleParty: {
                            accountNumber: {
                                value: this.configService.get<string>('FEDEX_ACCOUNT_NUMBER'),
                            },
                            address: {
                                countryCode: shipperCountryCode,
                            },
                        },
                    },
                    paymentType: 'SENDER',
                },
                customsClearanceDetail: {
                    documentContent: 'DOCUMENT',
                    dutiesPayment: {
                        payor: {
                            responsibleParty: {
                                accountNumber: {
                                    value: this.configService.get<string>('FEDEX_ACCOUNT_NUMBER'),
                                },
                                address: {
                                    countryCode: shipperCountryCode,
                                },
                            },
                        },
                        paymentType: 'SENDER',
                    },
                    commodities: order.parentShipment.items.map(i => ({
                        name: i.name,
                        description: i.description || i.name,
                        countryOfManufacture: i.countryOfManufacture || 'IN',
                        quantity: i.quantity || 1,
                        quantityUnits: i.quantityUnits || 'PCS',
                        unitPrice: { amount: i.unitPrice || 1, currency: 'INR' },
                        customsValue: { amount: i.unitPrice || 1, currency: 'INR' },
                        numberOfPieces: i.quantity || 1,
                        weight: { units: 'KG', value: i.weight || 1 },
                    })),
                },
                labelSpecification: {
                    labelFormatType: 'COMMON2D',
                    imageType: 'PDF',
                    labelStockType: 'PAPER_LETTER',
                },
                pickupType: 'USE_SCHEDULED_PICKUP',
                requestedPackageLineItems: order.parentShipment.items.map(i => ({
                    weight: { units: 'KG', value: i.weight || 1 },
                    dimensions: {
                        length: i.dimensions?.length || 1,
                        width: i.dimensions?.width || 1,
                        height: i.dimensions?.height || 1,
                        units: 'CM',
                    },
                    customerReferences: [{ type: 'CUSTOMER_REFERENCE', value: order.orderId }],
                    description: i.name,
                })),
                shipTimestamp: order.orderDate,
                emailNotificationDetail: {
                    recipients: [
                        {
                            emailAddress: shipperAddress.email || '',
                            notificationEventType: ['ON_DELIVERY', 'ON_EXCEPTION'],
                            notificationType: 'EMAIL',
                            notificationFormatType: 'HTML',
                            emailNotificationRecipientType: 'SHIPPER',
                            locale: 'en',
                        },
                    ],
                },
                packagingType: "YOUR_PACKAGING" //PACKAGING_TYPES.includes(order.productType) ? order.productType : null,
            },
        };
    }

    // ----------------------
    // 4. Map internal service to FedEx service
    // ----------------------
    private mapServiceType(serviceType: string) {
        const mapping = { FRDM: 'INTERNATIONAL_ECONOMY', PPX: 'FEDEX_INTERNATIONAL_PRIORITY' };
        return mapping[serviceType] || 'FEDEX_GROUND';
    }

    private async getAccountNumberForFedex(location: string, network: string) {
        return ACCOUNT_DETAILS.filter(
            account => account.location === location && account.network === network
        );
    }

    /**
    *  Make FedEx API call with OAuth2 token
    */
    private async callFedexPOSTAPI(url: string, body: any) {
        const authHeaders = await this.authProvider.getAuthHeaders();
        const response = await firstValueFrom(
            this.httpService.post(url, body, {
                headers: authHeaders,
                httpsAgent: this.httpsAgent,
                timeout: 30000,
            })
        );
        return response;
    }

    private async callFedexPutAPI(url: string, body: any) {
        const authHeaders = await this.authProvider.getAuthHeaders();
        const response = await firstValueFrom(
            this.httpService.put(url, body, {
                headers: authHeaders,
                httpsAgent: this.httpsAgent,
                timeout: 30000,
            })
        );
        return response;
    }

    async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
        data: T,
        partnerCode: string,
        eligiblePartners?: EligiblePartnersData
    ): Promise<R> {
        try {
            const endpoint = FEDEX_URLS.CANCEL_SHIPMENT;
            const awbNumber = data.cAwbNumbers?.[0] || '';
            //   const endpoint = {
            //     url: `${this.configService.get<string>('FEDEX_BASE_URL')}/cancel/${awbNumber}`
            //   };

            const body = {
                accountNumber: {
                    value: this.configService.get<string>('FEDEX_ACCOUNT_NUMBER'),
                },
                //  emailShipment: 'false',
                //  senderCountryCode: this.configService.get<string>('FEDEX_SENDER_COUNTRY') || 'US',
                //  deletionControl: 'DELETE_ALL_PACKAGES',
                trackingNumber: awbNumber,
                //  version: {
                //      major: '1',
                //      minor: '1',
                //      patch: '1',
                //  },
            };

            if (!endpoint) {
                throw new CustomHttpException(
                    HttpStatus.BAD_REQUEST,
                    'FEDEX_BASE_URL environment variable is not configured'
                );
            }
            const response = await this.callFedexPutAPI(endpoint, body);
            return {
                statusCode: 200,
                message: "Order cancelled successfully with FEDEX",
                data: response.data
            } as R;
        } catch (error) {
            this.logger.error(`FEDEX cancelOrder error: ${JSON.stringify(error)}`);
            throw error;
        }
    }

    async createPickupV2<T extends BaseReqDto, R extends BaseResDto>(
        data: T,
        partnerCode: string,
        eligiblePartners?: EligiblePartnersData
    ): Promise<R> {
        this.logger.debug(`Creating Pickup V2 with FEDEX for partner: ${partnerCode}`);
        const startTime = Date.now();

        try {
            // Validate input
            if (!data) {
                throw new CustomHttpException(
                    HttpStatus.BAD_REQUEST,
                    'Pickup data is required'
                );
            }
            const associatedAccountNumber = {
                associatedAccountNumber: {
                    value: this.configService.get<string>('FEDEX_ACCOUNT_NUMBER'),
                },
            };

            data = { ...data, ...associatedAccountNumber };
            // Build the URL from environment variable
            const pickupUrl = FEDEX_URLS.CREATE_PICKUP;

            if (!pickupUrl) {
                throw new CustomHttpException(
                    HttpStatus.BAD_REQUEST,
                    'FEDEX_EXPRESS_API_URL environment variable is not configured'
                );
            }

            // Get auth headers
            const authHeaders = await this.authProvider.getAuthHeaders();

            // Use fixed-length Message-Reference (exactly 28 characters)
            const messageReference = `pickup-${Date.now().toString().slice(-4)}-abcdefghijklmnop`;

            const requestHeaders = {
                ...authHeaders,
                'accept': 'application/json',
                'Message-Reference': messageReference,
                'Message-Reference-Date': new Date().toUTCString(),
                'Plugin-Name': '',
                'Plugin-Version': '',
                'Shipping-System-Platform-Name': '',
                'Shipping-System-Platform-Version': '',
                'Webstore-Platform-Name': '',
                'Webstore-Platform-Version': '',
                'x-version': '2.12.0',
                'Content-Type': 'application/json'
            };

            // Make the API call
            console.log("data -=====", data);
            const response = await firstValueFrom(
                this.httpService.post(pickupUrl, data, {
                    headers: requestHeaders,
                    httpsAgent: this.httpsAgent,
                    timeout: 30000,
                })
            );

            const responseTimeMs = Date.now() - startTime;
            this.logger.debug(`Pickup created successfully in ${responseTimeMs}ms`);

            // Return standardized response matching Shipyaari format
            return {
                statusCode: 200,
                message: "Pickup created successfully with FEDEX",
                partnerCode: this.partnerCode,
                data: {
                    success: true,
                    orderId: response.data?.dispatchConfirmationNumbers?.[0] || "",
                    cAwbNumber: response.data?.dispatchConfirmationNumbers?.[0] || "",
                    status: "PICKUP_CREATED",
                    message: "Pickup created successfully",
                    apiResponse: response.data,
                },
                trace: {
                    timestamp: new Date().toISOString(),
                    partnerCode: this.partnerCode,
                    operation: "CREATE_PICKUP",
                }
            } as R;

        } catch (error) {
            this.logger.error(`FEDEX createPickup error: ${JSON.stringify(error)}`);
            throw error;
        }
    }

    async cancelPickupV2<T extends BaseReqDto, R extends BaseResDto>(
        data: T,
        partnerCode: string,
        eligiblePartners?: EligiblePartnersData
    ): Promise<R> {
        this.logger.debug(`Cancelling Pickup V2 with FEDEX for partner: ${partnerCode}`);
        const startTime = Date.now();

        try {
            // Validate input
            if (!data || !(data as any).pickupId || !(data as any).requestorName || !(data as any).reason) {
                throw new CustomHttpException(
                    HttpStatus.BAD_REQUEST,
                    'pickupId, requestorName, and reason are required'
                );
            }

            const pickupData = data as any;

            // Build the URL from environment variable
            //   const baseUrl = this.configService.get<string>('FEDEX_EXPRESS_API_URL') || 'https://express.api.FEDEX.com/myFEDEXapi/test';
            const cancelPickupUrl = FEDEX_URLS.CANCEL_PICKUP;

            if (!cancelPickupUrl) {
                throw new CustomHttpException(
                    HttpStatus.BAD_REQUEST,
                    'FEDEX_EXPRESS_API_URL environment variable is not configured'
                );
            }

            // Get auth headers
            const authHeaders = await this.authProvider.getAuthHeaders();

            // Use fixed-length Message-Reference (exactly 28 characters)
            const messageReference = `del-${Date.now().toString().slice(-4)}-abcdefghijklmnopqrs`;

            const requestHeaders = {
                ...authHeaders,
                'Message-Reference': messageReference,
                'Message-Reference-Date': new Date().toUTCString(),
                'Plugin-Name': '',
                'Plugin-Version': '',
                'Shipping-System-Platform-Name': '',
                'Shipping-System-Platform-Version': '',
                'Webstore-Platform-Name': '',
                'Webstore-Platform-Version': '',
                'x-version': '2.12.0'
            };

            // Make the API call
            const response = await firstValueFrom(
                this.httpService.put(cancelPickupUrl, {
                    headers: requestHeaders,
                    httpsAgent: this.httpsAgent,
                    timeout: 30000,
                })
            );

            const responseTimeMs = Date.now() - startTime;
            this.logger.debug(`Pickup cancelled successfully in ${responseTimeMs}ms`);

            // Return standardized response matching Shipyaari format
            return {
                statusCode: 200,
                message: "Pickup cancelled successfully with FEDEX",
                partnerCode: this.partnerCode,
                data: {
                    success: true,
                    orderId: pickupData.pickupId || "",
                    cAwbNumber: pickupData.pickupId || "",
                    status: "PICKUP_CANCELLED",
                    message: "Pickup cancelled successfully",
                    apiResponse: response.data,
                },
                trace: {
                    timestamp: new Date().toISOString(),
                    partnerCode: this.partnerCode,
                    operation: "CANCEL_PICKUP",
                }
            } as R;

        } catch (error) {
            this.logger.error(`FEDEX cancelPickup error: ${JSON.stringify(error)}`);
            throw error;
        }
    }

    private async fetchAndValidateCountryCode(
        postalCode: string
    ): Promise<string> {
        const geo_url = this.configService.get<string>("GEO_LOCATION_URL");
        const url = `${geo_url}?&postal_codes=${postalCode}&offset=0&limit=1`;
        try {
            const resp = await firstValueFrom(this.httpService.get(url));
            const data = resp?.data?.data?.[0];
            const countryCode = data?.country_code?.trim();
            return countryCode;
        } catch (err) {
            throw new CustomHttpException(
                HttpStatus.BAD_REQUEST,
                `Failed to fetch geo-location for postal code not CA or US ${postalCode}`
            );
        }
    }

}
