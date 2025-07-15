import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";
import * as moment from "moment";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { DHLAuthService } from "./dhl-auth.service";
import { SHIPYAARI_ENV_VARS } from "../shipyaari/shipyaari.enum";

import {
  BaseOrderReqDtoV2,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
  BaseCancelOrderDto,
  DRSPayloadDTO,
  ManifestReqDto,
  BaseOrderReqDto,
  extractLineItems
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
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends any>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      // const awbNumber = orderDetails?.awbNumber || "";
      // this.logger.log(`Creating DHL order for AWB: ${awbNumber}`);

      // Get endpoint configuration
      const endpoint = {
        url: this.configService.get<string>('DHL_CREATE_ORDER_URL'),
      }

      // Transform the payload for DHL API
      const transformedData = this.transformDHLPayload(orderDetails);

      // Make API call
       const response = await this.callDHLCreateOrderAPI(
         endpoint,
         transformedData,
         
       );

       //Format and return response
      return this.formatCreateOrderResponse<any>(response);

      return transformedData
    } catch (error) {
      this.logger.error(`DHL createOrder error: ${JSON.stringify(error.response)}`);
      throw error;
    }
  }

  /**
   * Transform order request into DHL API format
   * - Extracts all line items from parent and child shipments
   * - Uses only addresses of type PICKUP and DELIVERY for shipper/receiver
   */
  private transformDHLPayload<T extends BaseOrderReqDtoV2>(orderDetails: T): any {
    console.log("dhl payload", orderDetails);
    // Extract all line items from parent and child shipments
    const lineItems = extractLineItems(orderDetails);

    // Gather all shipments: parent + children
    const shipments = [
      orderDetails.parentShipment,
      ...(orderDetails.childShipments || [])
    ].filter(Boolean);

    // Map each shipment to a DHL package object
    const packages = shipments.map((shipment, idx) => ({
      typeCode: "2BP",
      weight: shipment.physicalWeight,
      dimensions: {
        length: shipment.dimensions.length,
        width: shipment.dimensions.width,
        height: shipment.dimensions.height
      },
      customerReferences: [
        {
          value: shipment.awbNumber || orderDetails.awbNumber,
          typeCode: "CU"
        }
      ],
      description: shipment.items?.[0]?.description || "No description",
      labelDescription: shipment.items?.[0]?.description || "No description"
    }));

    // Find pickup and delivery addresses for DHL API
    const pickupAddress: any = orderDetails.addresses?.find((a: any) => a.type === 'PICKUP') || {};
    const deliveryAddress: any = orderDetails.addresses?.find((a: any) => a.type === 'DELIVERY') || {};

    // Build DHL API payload
    const transformedData = {
      plannedShippingDateAndTime: moment(orderDetails.orderDate).utcOffset('+05:30').format('YYYY-MM-DDTHH:mm:ss [GMT+05:30]'),
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
        packages: packages,
        isCustomsDeclarable: true,
        declaredValue: orderDetails.payment.finalAmount,
        declaredValueCurrency:"INR",
        description: lineItems[0]?.description || orderDetails.parentShipment.items[0].description,
        incoterm: "DAP",
        unitOfMeasurement: "metric",
        exportDeclaration: {
          lineItems: lineItems.map((item, idx) => {
            // Determine the correct AWB number for customerReferences
            let awbNumber = orderDetails.parentShipment?.awbNumber;
            if (item._shipmentType === 'child' && item._shipmentIndex !== undefined && orderDetails.childShipments) {
              awbNumber = orderDetails.childShipments[item._shipmentIndex]?.awbNumber || awbNumber;
            }
            return {
              number: idx + 1,
              description: item.description,
              price: item.unitPrice,
              quantity: {
                value: item.quantity,
                unitOfMeasurement: "KG"
              },
              commodityCodes: [
                {
                  typeCode: "outbound",
                  value: item.hsnCode || "84713000"
                }
              ],
              exportReasonType: "permanent",
              manufacturerCountry: "IN",
              weight: {
                netValue: item.weight,
                grossValue: item.weight
              },
              isTaxesPaid: true,
              customerReferences: [
                {
                  typeCode: "AFE",
                  value: awbNumber
                }
              ]
            };
          }),
          invoice: {
            number: `INV-${orderDetails.parentShipment?.awbNumber}`,
            date: moment(orderDetails.orderDate).utcOffset('+05:30').format('YYYY-MM-DD'),
            instructions: [
              orderDetails.parentShipment?.note || ""
            ],
            totalNetWeight: lineItems.reduce((sum, item) => sum + (item.weight || 0), 0),
            totalGrossWeight: lineItems.reduce((sum, item) => sum + (item.weight || 0), 0)
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
        // Use only PICKUP for shipper and DELIVERY for receiver
        shipperDetails: {
          postalAddress: {
            postalCode: pickupAddress.zip || "",
            cityName: pickupAddress.city || "",
            countryCode: pickupAddress.countryCode || "IN",
            addressLine1: pickupAddress.street || "",
            countryName: pickupAddress.country || "India"
          },
          contactInformation: {
            email: pickupAddress.email || "",
            phone: pickupAddress.phone || "",
            mobilePhone: pickupAddress.phone || "",
            companyName: pickupAddress.addressName || "",
            fullName: pickupAddress.name || ""
          },
          typeCode: "business"
        },
        receiverDetails: {
          postalAddress: {
            postalCode: deliveryAddress.zip || "",
            cityName: deliveryAddress.city || "",
            countyName: deliveryAddress.state || "",
            countryCode: deliveryAddress.countryCode || "IN",
            addressLine1: deliveryAddress.street || "",
            countryName: deliveryAddress.country || "India"
          },
          contactInformation: {
            email: deliveryAddress.email || "",
            phone: deliveryAddress.phone || "",
            mobilePhone: deliveryAddress.phone || "",
            companyName: deliveryAddress.addressName || "",
            fullName: deliveryAddress.name || ""
          },
          typeCode: "business"
        }
      },
      shipmentNotification: [
        {
          typeCode: "email",
          receiverId: "pratik.ranjan@shreemaruti.com",
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
          isRequested: false
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
  ): Promise<AxiosResponse<any>> {
    // Log request
 

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
              "Authorization": `Basic ${this.configService.get<string>('DHL_AUTH_TOKEN')}`,
              "Content-Type": "application/json"
            },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          }
        )
      );

   

      return response;
    } catch (error) {
      console.log("dhl error", JSON.stringify(payload));
      console.log("dhl end of line for payload");
   
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
