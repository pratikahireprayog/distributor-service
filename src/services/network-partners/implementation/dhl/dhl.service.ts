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
  BaseOrderResDto,
 
} from "src/common/dtos/base.dto";
import { BaseOrderReqDtoV2,BaseReqDto,extractLineItems } from "src/common/dtos/base2.dto";

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
      // 1. Extract pickup address zip
      const pickupAddress: any = orderDetails.addresses?.find((a: any) => a.type === 'PICKUP') || {};
      const pickupZip = pickupAddress.zip || pickupAddress.postalCode || pickupAddress.pincode || pickupAddress.pin || pickupAddress.PIN || pickupAddress.PINCODE;
      if (!pickupZip) {
        throw new CustomHttpException(HttpStatus.BAD_REQUEST, 'Pickup address zip is required for DHL account lookup');
      }

      // 2. Fetch city code using helper
      const cityCode = await this.fetchCityCodeFromZip(pickupZip);
      if (!cityCode) {
        throw new CustomHttpException(HttpStatus.BAD_REQUEST, `Could not fetch city_code from nearest hub API`);
      }

      // 3. Fetch partner_id
      let partnerId: string | undefined = undefined;
      if (eligiblePartners && Array.isArray(eligiblePartners.data) && eligiblePartners.data.length > 0) {
        partnerId = String(eligiblePartners.data[0].id);
      }
      partnerId =this.configService.get<string>('DHL_PARTNER_ID');
      if (!partnerId) {
        throw new CustomHttpException(HttpStatus.BAD_REQUEST, 'partner_id is required for DHL partner-configs lookup');
      }

      // 4. Fetch account_id using helper
      const accountId = await this.fetchAccountIdFromPartnerConfig(partnerId, cityCode);
      if (!accountId) {
        throw new CustomHttpException(HttpStatus.BAD_REQUEST, 'Could not fetch account_id from partner configs API');
      }

      // 5. Get endpoint configuration
      const endpoint = {
        url: this.configService.get<string>('DHL_CREATE_ORDER_URL'),
      }

      // 6. Transform the payload for DHL API, injecting the accountId
      const transformedData = await this.transformCreateDHLPayload(orderDetails, accountId);

      // 7. Make API call
      const response = await this.callDHLCreateOrderAPI(
        endpoint,
        transformedData,
      );

      // 8. Format and return response
      return this.formatCreateOrderResponse<any>(response);
    } catch (error) {
      this.logger.error(`DHL createOrder error: ${JSON.stringify(error.response)}`);
      throw error;
    }
  }

  // Helper to fetch city code from nearest-hub-locations API
  private async fetchCityCodeFromZip(zip: string): Promise<string | undefined> {
    const url = this.configService.get<string>('SERVICEABILITY_HUB_CODE_URL');
    const nearestHubUrl = `${url}/${zip}`;
    const nearestHubResp = await firstValueFrom(this.httpService.get(nearestHubUrl));
    return nearestHubResp?.data?.data?.hub_city_code;
  }

  // Helper to fetch account_id from partner-configs API
  private async fetchAccountIdFromPartnerConfig(partnerId: string, cityCode: string): Promise<string | undefined> {
    const url=this.configService.get<string>('PARTNER_CONFIG_URL');
    const partnerConfigsUrl = `${url}/?partner_id=${partnerId}&city_code=${cityCode}`;
    const partnerConfigsResp = await firstValueFrom(this.httpService.get(partnerConfigsUrl));
    return partnerConfigsResp?.data?.data?.[0]?.account_id;
  }


  /**
   * Fetch geo-location info for a postal code and validate country_code
   * Throws error if country_code is not US or CA
   */
  private async fetchAndValidateCountryCode(postalCode: string): Promise<string> {
    const geo_url = this.configService.get<string>('GEO_LOCATION_URL');
    const url = `${geo_url}?&postal_codes=${postalCode}&offset=0&limit=1`;
    try {
      const resp = await firstValueFrom(this.httpService.get(url));
      const data = resp?.data?.data?.[0];
      const countryCode = data?.country_code?.trim();
      if (!countryCode || (countryCode !== "US" && countryCode !== "CA")) {
        throw new CustomHttpException(HttpStatus.BAD_REQUEST, `Country code for postal code ${postalCode} is not supported: ${countryCode}`);
      }
      return countryCode;
    } catch (err) {
      throw new CustomHttpException(HttpStatus.BAD_REQUEST, `Failed to fetch geo-location for postal code not CA or US ${postalCode}`);
    }
  }

  /**
   * Transform order request into DHL API format
   * - Extracts all line items from parent and child shipments
   * - Uses only addresses of type PICKUP and DELIVERY for shipper/receiver
   */
  private async transformCreateDHLPayload<T extends BaseOrderReqDtoV2>(orderDetails: T, accountId: string): Promise<any> {
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

    // Fetch and validate country codes for pickup and delivery
    const shipperCountryCode = await this.fetchAndValidateCountryCode(pickupAddress.zip || pickupAddress.postalCode || "");
    const receiverCountryCode = await this.fetchAndValidateCountryCode(deliveryAddress.zip || deliveryAddress.postalCode || "");

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
          number: accountId
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
            countryCode: shipperCountryCode,
            addressLine1: pickupAddress.street || "",
            countryName: pickupAddress.country || "United States"
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
            countryCode: receiverCountryCode,
            addressLine1: deliveryAddress.street || "",
            countryName: deliveryAddress.country || "United States"
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
