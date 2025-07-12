import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { DHLAuthService } from "./dhl-auth.service";
import { SHIPYAARI_ENV_VARS } from "../shipyaari/shipyaari.enum";

import {
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
  BaseCancelOrderDto,
  DRSPayloadDTO,
  ManifestReqDto,
} from "src/common/dtos/base.dto";

import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { ENDPOINT_ID_ENUM, PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { AxiosResponse } from "axios";
import { EndpointConfigModel } from "src/common/repositories/endpoint-configs/endpoint-configs.schema";

@Injectable()
export class DHLService extends BaseNetworkPartner {
  protected readonly logger = new Logger(DHLService.name);
  private readonly httpsAgent: https.Agent;

  constructor(
    protected readonly authProvider: DHLAuthService,
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.DHL,
      authProvider,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );

    // Configure HTTPS agent with proper keep-alive and timeouts
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      timeout: 60000,
    });
  }

  /**
   * Create an order with DHL
   */
  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      const awbNumber = orderDetails?.awbNumber || "";
      this.logger.log(`Creating DHL order for AWB: ${awbNumber}`);

      // Get endpoint configuration
      const endpoint = {
        url: "https://express.api.dhl.com/mydhlapi/shipments",
      }

      // Transform the payload
      const transformedData = this.transformDHLPayload(orderDetails);

      // Make API call
      const response = await this.callDHLCreateOrderAPI(
        endpoint,
        transformedData,
        awbNumber
      );

      // Format and return response
      return this.formatCreateOrderResponse<R>(response);
    } catch (error) {
      this.logger.error(`DHL createOrder error: ${JSON.stringify(error.response.data.message)}`);
      throw error;
    }
  }

    /**
   * Transform order request into DHL API format
   */
  private transformDHLPayload<T extends BaseOrderReqDto>(orderDetails: T): any {
    console.log("dhl payload", orderDetails);
    // Use the exact payload structure as provided
    const transformedData = {
      plannedShippingDateAndTime: "2025-07-12T10:00:00 GMT+05:30",
      pickup: {
        isRequested: false
      },
      productCode: "P",
      localProductCode: "P",
      getRateEstimates: false,
      accounts: [
        {
          typeCode: "shipper",
          number: "535911093"
        }
      ],
      content: {
        packages: [
          {
            typeCode: "2BP",
            weight: 1.5,
            dimensions: {
              length: 30,
              width: 20,
              height: 10
            },
            customerReferences: [
              {
                value: "BOOK0000000352",
                typeCode: "CU"
              }
            ],
            description: "CUSTOMIZED FASHION GARMENTS",
            labelDescription: "Ref: BOOK0000000352"
          }
        ],
        isCustomsDeclarable: true,
        declaredValue: 5000,
        declaredValueCurrency: "USD",
        description: "Shipment",
        incoterm: "DAP",
        unitOfMeasurement: "metric",
        exportDeclaration: {
          lineItems: [
            {
              number: 1,
              description: "Fashion Garments",
              price: 5000,
              quantity: {
                value: 1,
                unitOfMeasurement: "KG"
              },
              commodityCodes: [
                {
                  typeCode: "outbound",
                  value: "84713000"
                }
              ],
              exportReasonType: "permanent",
              manufacturerCountry: "IN",
              weight: {
                netValue: 1.5,
                grossValue: 1.5
              },
              isTaxesPaid: true,
              customerReferences: [
                {
                  typeCode: "AFE",
                  value: "BOOK0000000352"
                }
              ]
            }
          ],
          invoice: {
            number: "INV-BOOK0000000352",
            date: "2025-07-11",
            instructions: [
              "Handle with care"
            ],
            totalNetWeight: 1.5,
            totalGrossWeight: 1.5
          }
        }
      },
      outputImageProperties: {
        printerDPI: 300,
        encodingFormat: "pdf",
        imageOptions: [
          {
            typeCode: "invoice",
            templateName: "COMMERCIAL_INVOICE_P_10",
            isRequested: true,
            invoiceType: "commercial",
            languageCode: "eng",
            languageCountryCode: "US"
          },
          {
            typeCode: "waybillDoc",
            templateName: "ARCH_8x4",
            isRequested: true,
            hideAccountNumber: false,
            numberOfCopies: 1
          },
          {
            typeCode: "label",
            templateName: "ECOM26_84_001",
            renderDHLLogo: true,
            fitLabelsToA4: false
          }
        ],
        splitTransportAndWaybillDocLabels: true,
        allDocumentsInOneImage: false,
        splitDocumentsByPages: false,
        splitInvoiceAndReceipt: true,
        receiptAndLabelsInOneImage: false
      },
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            postalCode: "560086",
            cityName: "Bangalore",
            countryCode: "IN",
            addressLine1: "MG Road, Near Church Street",
            countryName: "India"
          },
          contactInformation: {
            email: "shipper@example.com",
            phone: "9876543210",
            mobilePhone: "9876543210",
            companyName: "Shipper Pvt Ltd",
            fullName: "Ramesh"
          },
          typeCode: "business"
        },
        receiverDetails: {
          postalAddress: {
            postalCode: "266001",
            cityName: "QING DAO",
            countyName: "Shandong",
            countryCode: "CN",
            addressLine1: "123 Beijing Road",
            countryName: "China"
          },
          contactInformation: {
            email: "receiver@example.cn",
            phone: "02112345678",
            mobilePhone: "13800138000",
            companyName: "Receiver Ltd",
            fullName: "Li Wei"
          },
          typeCode: "business"
        }
      },
      shipmentNotification: [
        {
          typeCode: "email",
          receiverId: "shipmentnotification@mydhlapisample.com",
          languageCode: "eng",
          languageCountryCode: "UK",
          bespokeMessage: "message to be included in the notification"
        }
      ],
      getTransliteratedResponse: false,
      estimatedDeliveryDate: {
        isRequested: true,
        typeCode: "QDDC"
      },
      getAdditionalInformation: [
        {
          typeCode: "pickupDetails",
          isRequested: true
        }
      ]
    };

    this.logger.log(
      `[DHL createOrder] Transformed request payload: ${JSON.stringify(transformedData)}`
    );

    return transformedData;
  }


  /**
   * Get endpoint configuration for DHL API
   */
  private async fetchEndpointConfig(
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

  /**
   * Make API call to DHL order API
   */
  private async callDHLCreateOrderAPI(
    endpoint: any,
    payload: any,
    awbNumber: string
  ): Promise<AxiosResponse<any>> {
    // Log request
    this.logger.log(
      `[DHL createOrder] Request for AWB: ${awbNumber} - Payload: ${JSON.stringify(payload)}`
    );

    console.log("dhl transformed payload", JSON.stringify(payload));
    console.log("dhl end of line");

    try {
      // Generate message reference with proper length (28-36 characters)
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 10);
      const messageReference = `dhl-${timestamp}-${randomId}`; // Ensures 28+ characters
      const messageReferenceDate = new Date().toUTCString();

      const response = await firstValueFrom(
        this.httpService.post(
          `${endpoint.url}?strictValidation=false&bypassPLTError=false&validateDataOnly=false`,
          payload,
          {
            headers: {
              "accept": "application/json",
              "Message-Reference": messageReference,
              "Message-Reference-Date": messageReferenceDate,
              "Plugin-Name": "",
              "Plugin-Version": "",
              "Shipping-System-Platform-Name": "",
              "Shipping-System-Platform-Version": "",
              "Webstore-Platform-Name": "",
              "Webstore-Platform-Version": "",
              "x-version": "2.12.0",
              "Authorization": `Basic ${this.configService.get<string>('DHL_AUTH_TOKEN') || 'c2hyZWVtYXJ1dDlJTjpEJDZwUCM0blZAMmdCXjB6'}`,
              "Content-Type": "application/json"
            },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          }
        )
      );

      this.logger.log(
        `[DHL createOrder] Response for AWB: ${awbNumber} - ${JSON.stringify(response.data)}`
      );

      return response;
    } catch (error) {
      console.log("dhl error", JSON.stringify(payload));
      console.log("dhl end of line for payload");
      this.logger.error(
        `[DHL createOrder] Error for AWB: ${awbNumber} - ${JSON.stringify(error.response?.data || error.message)}`
      );
      throw error;
    }
  }

  /**
   * Format DHL create order response
   */
  private formatCreateOrderResponse<R extends BaseOrderResDto>(
    response: AxiosResponse<any>
  ): R {
    const responseData = response.data;

    // Check if the response contains an error
    if (responseData.errors && responseData.errors.length > 0) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        `DHL API Error: ${responseData.errors[0].message || 'Unknown error'}`
      );
    }

    // Extract tracking information from DHL response
    const shipment = responseData.shipments?.[0];
    const trackingNumber = shipment?.shipmentTrackingNumber;
    const labelUrl = shipment?.documents?.[0]?.documentContent;

    return {
      statusCode: 200,
      message: "Order created successfully with DHL",
      partnerCode: this.partnerCode,
      data: {
        trackingId: trackingNumber,
        referenceNumber: trackingNumber,
        labelUrl: labelUrl,
        rawResponse: responseData
      }
    } as R;
  }
}
