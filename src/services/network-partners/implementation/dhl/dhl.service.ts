import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";
import * as moment from "moment";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { DHLAuthService } from "./dhl-auth.service";
import { SHIPYAARI_ENV_VARS } from "../shipyaari/shipyaari.enum";

import { BaseOrderResDto, BaseResDto } from "src/common/dtos/base.dto";
import {
  BaseOrderReqDtoV2,
  BaseCancelOrderDtoV2,
  BaseReqDto,
  extractLineItems,
  BaseUpdateOrderDtoV2,
} from "src/common/dtos/base2.dto";

import { EligiblePartnersData } from "src/common/dtos/global.dto";
import {
  ENDPOINT_ID_ENUM,
  PARTNER_CODE_ENUM,
} from "src/common/enums/global.enum";
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
    // Initialize endpoint outside try block for error handling
    const endpoint = {
      url: this.configService.get<string>("DHL_CREATE_ORDER_URL"),
    };

    try {
      // 1. Extract pickup address zip
      const pickupAddress: any =
        orderDetails.addresses?.find((a: any) => a.type === "PICKUP") || {};
      const pickupZip =
        pickupAddress.zip ||
        pickupAddress.postalCode ||
        pickupAddress.pincode ||
        pickupAddress.pin ||
        pickupAddress.PIN ||
        pickupAddress.PINCODE;
      if (!pickupZip) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "Pickup address zip is required for DHL account lookup"
        );
      }

      // 2. Fetch city code using helper
      const cityCode = await this.fetchCityCodeFromZip(pickupZip);
      if (!cityCode) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Could not fetch city_code from nearest hub API`
        );
      }

      // 3. Fetch partner_id
      let partnerId: string | undefined = undefined;
      if (
        eligiblePartners &&
        Array.isArray(eligiblePartners.data) &&
        eligiblePartners.data.length > 0
      ) {
        partnerId = String(eligiblePartners.data[0].id);
      }
      partnerId = this.configService.get<string>("DHL_PARTNER_ID");
      if (!partnerId) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "partner_id is required for DHL partner-configs lookup"
        );
      }

      // 4. Fetch account_id using helper
      const accountId = await this.fetchAccountIdFromPartnerConfig(
        partnerId,
        cityCode
      );
      if (!accountId) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "Could not fetch account_id from partner configs API"
        );
      }

      // 5. Transform the payload for DHL API, injecting the accountId
      const transformedData = await this.transformCreateDHLPayload(
        orderDetails,
        accountId
      );

      // 6. Make API call
      const apiResult = await this.callDHLCreateOrderAPI(
        endpoint,
        transformedData
      );

      // 7. Format and return response
      return this.formatCreateOrderResponse<any>(apiResult);
    } catch (error) {
      this.logger.error(`DHL createOrder error: ${JSON.stringify(error)}`);

      // Return consistent error structure for exceptions
      const errorResponse = {
        statusCode: error.status || error.response?.status || 500,
        message: `DHL createOrder failed: ${error.message || "Unknown error"}`,
        data: {
          originalResponse: error.response?.data || null,
          requestUrl: (error as any).requestUrl || endpoint?.url || "unknown",
          requestBody: (error as any).requestBody || null,
          errorDetails: {
            name: error.name,
            message: error.message,
            code: error.code,
          },
        },
        trace: {
          timestamp: new Date().toISOString(),
          partnerCode: this.partnerCode,
        },
      };

      // If it's a CustomHttpException, we want to maintain the original behavior
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // For other errors, return the consistent structure instead of throwing
      return errorResponse as any;
    }
  }

  /**
   * Create pickup request V2 with DHL
   */
  async createPickupV2<T extends BaseReqDto, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.debug(`Creating Pickup V2 with DHL for partner: ${partnerCode}`);
    const startTime = Date.now();

    try {
      // Validate input
      if (!data) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Pickup data is required'
        );
      }

      // Build the URL from environment variable
      const baseUrl = this.configService.get<string>('DHL_EXPRESS_API_URL') || 'https://express.api.dhl.com/mydhlapi/test';
      const pickupUrl = `${baseUrl}/pickups`;

      if (!baseUrl) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'DHL_EXPRESS_API_URL environment variable is not configured'
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
        message: "Pickup created successfully with DHL",
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
      this.logger.error(`DHL createPickup error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  /**
   * Cancel pickup request V2 with DHL
   */
  async cancelPickupV2<T extends BaseReqDto, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.debug(`Cancelling Pickup V2 with DHL for partner: ${partnerCode}`);
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
      const baseUrl = this.configService.get<string>('DHL_EXPRESS_API_URL') || 'https://express.api.dhl.com/mydhlapi/test';
      const cancelPickupUrl = `${baseUrl}/pickups/${pickupData.pickupId}?requestorName=${encodeURIComponent(pickupData.requestorName)}&reason=${encodeURIComponent(pickupData.reason)}`;

      if (!baseUrl) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'DHL_EXPRESS_API_URL environment variable is not configured'
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
        this.httpService.delete(cancelPickupUrl, {
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
        message: "Pickup cancelled successfully with DHL",
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
      this.logger.error(`DHL cancelPickup error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // Helper to fetch city code from nearest-hub-locations API
  private async fetchCityCodeFromZip(zip: string): Promise<string | undefined> {
    const url = this.configService.get<string>("SERVICEABILITY_HUB_CODE_URL");
    const nearestHubUrl = `${url}/${zip}`;
    const nearestHubResp = await firstValueFrom(
      this.httpService.get(nearestHubUrl)
    );
    return nearestHubResp?.data?.data?.hub_city_code;
  }

  // Helper to fetch account_id from partner-configs API
  private async fetchAccountIdFromPartnerConfig(
    partnerId: string,
    cityCode: string
  ): Promise<string | undefined> {
    const url = this.configService.get<string>("PARTNER_CONFIG_URL");
    const partnerConfigsUrl = `${url}/?partner_id=${partnerId}&city_code=${cityCode}`;
    const partnerConfigsResp = await firstValueFrom(
      this.httpService.get(partnerConfigsUrl)
    );
    return partnerConfigsResp?.data?.data?.[0]?.account_id;
  }

  /**
   * Fetch geo-location info for a postal code and validate country_code
   * Throws error if country_code is not US or CA
   */
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

  /**
   * Transform order request into DHL API format
   * - Extracts all line items from parent and child shipments
   * - Uses only addresses of type PICKUP and DELIVERY for shipper/receiver
   */
  private async transformCreateDHLPayload<T extends BaseOrderReqDtoV2>(
    orderDetails: T,
    accountId: string
  ): Promise<any> {
    console.log("dhl payload", orderDetails);
    // Extract all line items from parent and child shipments
    const lineItems = extractLineItems(orderDetails);

    // Gather all shipments: parent + children
    const shipments = [
      orderDetails.parentShipment,
      ...(orderDetails.childShipments || []),
    ].filter(Boolean);

    // Calculate combined items weight across parent and child shipments (for fallback)
    const totalItemWeightAllShipments = shipments.reduce(
      (grandTotal: number, shp: any) => {
        const perShipmentItems = shp?.items || [];
        const perShipmentSum = perShipmentItems.reduce(
          (totalWeight: number, item: any) => {
            const itemWeight = Number(item?.weight) || 0;
            const itemQuantity = Number(item?.quantity) || 1;
            return totalWeight + itemWeight * itemQuantity;
          },
          0
        );
        return grandTotal + perShipmentSum;
      },
      0
    );

    // Map each shipment to a DHL package object
    const packages = shipments.map((shipment, idx) => {
      const itemWeightSum = (shipment.items || []).reduce(
        (totalWeight: number, item: any) => {
          const itemWeight = Number(item?.weight) || 0;
          const itemQuantity = Number(item?.quantity) || 1;
          return totalWeight + itemWeight * itemQuantity;
        },
        0
      );

      return {
        typeCode: "2BP",
        // Use shipment physicalWeight; if missing/zero/invalid, fallback to per-shipment items sum,
        // and finally fallback to total items sum across parent + child shipments
        weight: (itemWeightSum),
        dimensions: {
          length: shipment.dimensions.length,
          width: shipment.dimensions.width,
          height: shipment.dimensions.height,
        },
        customerReferences: [
          {
            value: shipment.awbNumber || orderDetails.awbNumber,
            typeCode: "CU",
          },
        ],
        description: shipment.items?.[0]?.description || "No description",
        labelDescription: shipment.items?.[0]?.description || "No description",
        
      };
    });

    // Find pickup and delivery addresses for DHL API
    const pickupAddress: any =
      orderDetails.addresses?.find((a: any) => a.type === "PICKUP") || {};
    const deliveryAddress: any =
      orderDetails.addresses?.find((a: any) => a.type === "DELIVERY") || {};

    // Fetch and validate country codes for pickup and delivery
    const shipperCountryCode = await this.fetchAndValidateCountryCode(
      pickupAddress.zip || pickupAddress.postalCode || ""
    );
    const receiverCountryCode = await this.fetchAndValidateCountryCode(
      deliveryAddress.zip || deliveryAddress.postalCode || ""
    );

    // if (
    //   !receiverCountryCode ||
    //   (receiverCountryCode !== "US" && receiverCountryCode !== "CA")
    // ) {
    //   throw new CustomHttpException(
    //     HttpStatus.BAD_REQUEST,
    //     `Country code for postal code ${deliveryAddress.zip} is not supported: ${receiverCountryCode}`
    //   );
    // }

    // Build DHL API payload
    const transformedData = {
      plannedShippingDateAndTime: moment(orderDetails.orderDate)
        .utcOffset("+05:30")
        .format("YYYY-MM-DDTHH:mm:ss [GMT+05:30]"),
      pickup: {
        isRequested: false,
      },
      productCode: "P",
      localProductCode: "P",
      getRateEstimates: false,
      accounts: [
        {
          typeCode: "shipper",
          number: accountId,
        },
      ],
      content: {
        packages: packages,
        isCustomsDeclarable: true,
        declaredValue: orderDetails.payment.finalAmount,
        declaredValueCurrency: "INR",
        description:
          lineItems[0]?.description ||
          orderDetails.parentShipment.items[0].description,
        incoterm: "DAP",
        unitOfMeasurement: "metric",
        exportDeclaration: {
          lineItems: lineItems.map((item, idx) => {
            // Determine the correct AWB number for customerReferences
            let awbNumber = orderDetails.parentShipment?.awbNumber;
            if (
              item._shipmentType === "child" &&
              item._shipmentIndex !== undefined &&
              orderDetails.childShipments
            ) {
              awbNumber =
                orderDetails.childShipments[item._shipmentIndex]?.awbNumber ||
                awbNumber;
            }
            return {
              number: idx + 1,
              description: item.description,
              price: Number(item.unitPrice) || 0,
              quantity: {
                value: item.quantity,
                unitOfMeasurement: "KG",
              },
              commodityCodes: [
                {
                  typeCode: "outbound",
                  value: item.hsnCode || "84713000",
                },
              ],
              exportReasonType: "permanent",
              manufacturerCountry: "IN",
              weight: {
                netValue: Number(item.weight) || 0,
                grossValue: Number(item.weight) || 0,
              },
              isTaxesPaid: true,
              customerReferences: [
                {
                  typeCode: "AFE",
                  value: awbNumber,
                },
              ],
            };
          }),
          invoice: {
            number: `INV-${orderDetails.parentShipment?.awbNumber}`,
            date: moment(orderDetails.orderDate)
              .utcOffset("+05:30")
              .format("YYYY-MM-DD"),
            instructions: ["Instructions"],
            totalNetWeight: lineItems.reduce(
              (sum, item) => sum + (Number(item.weight) || 0),
              0
            ),
            totalGrossWeight: lineItems.reduce(
              (sum, item) => sum + (Number(item.weight) || 0),
              0
            ),
          },
        },
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
            languageCountryCode: "US",
          },
          {
            typeCode: "waybillDoc",
            templateName: "ARCH_8x4",
            isRequested: true,
            hideAccountNumber: false,
            numberOfCopies: 1,
          },
          {
            typeCode: "label",
            templateName: "ECOM26_84_001",
            renderDHLLogo: true,
            fitLabelsToA4: false,
          },
        ],
        splitTransportAndWaybillDocLabels: true,
        allDocumentsInOneImage: false,
        splitDocumentsByPages: false,
        splitInvoiceAndReceipt: true,
        receiptAndLabelsInOneImage: false,
      },
      customerDetails: {
        // Use only PICKUP for shipper and DELIVERY for receiver
        shipperDetails: {
          postalAddress: {
            postalCode: pickupAddress.zip || "",
            cityName: pickupAddress.city || "",
            countryCode: shipperCountryCode,
            addressLine1: pickupAddress.street || "",
            countryName: pickupAddress.country || "United States",
          },
          contactInformation: {
            email: pickupAddress.email || "",
            phone: pickupAddress.phone || "",
            mobilePhone: pickupAddress.phone || "",
            companyName: pickupAddress.name || "",
            fullName: pickupAddress.name || "",
          },
          typeCode: "business",
        },
        receiverDetails: {
          postalAddress: {
            postalCode: deliveryAddress.zip || "",
            cityName: deliveryAddress.city || "",
            countyName: deliveryAddress.state || "",
            countryCode: receiverCountryCode,
            addressLine1: deliveryAddress.street || "",
            countryName: deliveryAddress.country || "United States",
          },
          contactInformation: {
            email: deliveryAddress.email || "",
            phone: deliveryAddress.phone || "",
            mobilePhone: deliveryAddress.phone || "",
            companyName: deliveryAddress.name || "",
            fullName: deliveryAddress.name || "",
          },
          typeCode: "business",
        },
      },
      shipmentNotification: [
        {
          typeCode: "email",
          receiverId: "pratik.ranjan@shreemaruti.com",
          languageCode: "eng",
          languageCountryCode: "UK",
          bespokeMessage: "message to be included in the notification",
        },
      ],
      getTransliteratedResponse: false,
      estimatedDeliveryDate: {
        isRequested: true,
        typeCode: "QDDC",
      },
      getAdditionalInformation: [
        {
          typeCode: "pickupDetails",
          isRequested: false,
        },
      ],
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
    payload: any
  ): Promise<{
    response: AxiosResponse<any>;
    requestUrl: string;
    requestBody: any;
  }> {
    // Log request
    console.log("dhl transformed payload", JSON.stringify(payload));
    console.log("dhl end of line");

    const requestUrl = `${endpoint.url}?strictValidation=false&bypassPLTError=false&validateDataOnly=false`;

    try {
      // Generate message reference with proper length (28-36 characters)
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 10);
      const messageReference = `dhl-${timestamp}-${randomId}`; // Ensures 28+ characters
      const messageReferenceDate = new Date().toUTCString();

      const response = await firstValueFrom(
        this.httpService.post(requestUrl, payload, {
          headers: {
            accept: "application/json",
            "Message-Reference": messageReference,
            "Message-Reference-Date": messageReferenceDate,
            "Plugin-Name": "",
            "Plugin-Version": "",
            "Shipping-System-Platform-Name": "",
            "Shipping-System-Platform-Version": "",
            "Webstore-Platform-Name": "",
            "Webstore-Platform-Version": "",
            "x-version": "2.12.0",
            Authorization: `Basic ${this.configService.get<string>("DHL_AUTH_TOKEN")}`,
            "Content-Type": "application/json",
          },
          httpsAgent: this.httpsAgent,
          timeout: 30000,
        })
      );

      return { response, requestUrl, requestBody: payload };
    } catch (error) {
      console.log("dhl error", JSON.stringify(payload));
      console.log("dhl end of line for payload");

      // Attach request details to error for consistent error handling
      (error as any).requestUrl = requestUrl;
      (error as any).requestBody = payload;
      throw error;
    }
  }

  /**
   * Cancel an order with DHL
   */
  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      const awbNumber = data.cAwbNumbers?.[0] || '';
      const endpoint = {
        url: `${this.configService.get<string>('DHL_BASE_URL')}/cancel/${awbNumber}`
      };

      if (!endpoint.url) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'DHL_BASE_URL environment variable is not configured'
        );
      }

      const authHeaders = await this.authProvider.getAuthHeaders();
      
      const response = await firstValueFrom(
        this.httpService.delete(endpoint.url, {
          headers: authHeaders,
          httpsAgent: this.httpsAgent,
          timeout: 30000,
        })
      );

      return {
        statusCode: 200,
        message: "Order cancelled successfully with DHL",
        data: response.data
      } as R;
    } catch (error) {
      this.logger.error(`DHL cancelOrder error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  /**
   * Update an order with DHL
   */
  async updateOrderV2<T extends BaseUpdateOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      const awbNumber = data.awbNumber;
      const endpoint = {
        url: `${this.configService.get<string>('DHL_BASE_URL')}/update/${awbNumber}`
      };

      if (!endpoint.url) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'DHL_BASE_URL environment variable is not configured'
        );
      }

      // Transform the update data to DHL format
      const updatePayload = this.transformDHLUpdatePayload(data);
      
      const authHeaders = await this.authProvider.getAuthHeaders();
      
      const response = await firstValueFrom(
        this.httpService.put(endpoint.url, updatePayload, {
          headers: authHeaders,
          httpsAgent: this.httpsAgent,
          timeout: 30000,
        })
      );

      return {
        statusCode: 200,
        message: "Order updated successfully with DHL",
        data: response.data
      } as R;
    } catch (error) {
      this.logger.error(`DHL updateOrder error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  /**
   * Transform update data to DHL format
   */
  private transformDHLUpdatePayload(data: BaseUpdateOrderDtoV2): any {
    const payload: any = {
      orderId: data.orderId,
      awbNumber: data.awbNumber
    };

    if (data.expectedDeliveryDate) {
      payload.expectedDeliveryDate = data.expectedDeliveryDate;
    }

    if (data.serviceType) {
      payload.serviceType = data.serviceType;
    }

    if (data.orderStatus) {
      payload.orderStatus = data.orderStatus;
    }

    if (data.addresses && data.addresses.length > 0) {
      payload.addresses = data.addresses;
    }

    if (data.parentShipment) {
      payload.parentShipment = data.parentShipment;
    }

    if (data.payment) {
      payload.payment = data.payment;
    }

    return payload;
  }

  /**
   * Format DHL create order response
   */
  private formatCreateOrderResponse<R extends BaseOrderResDto>(apiResult: {
    response: AxiosResponse<any>;
    requestUrl: string;
    requestBody: any;
  }): R {
    const { response, requestUrl, requestBody } = apiResult;
    const responseData = response.data;

    // Check if the response contains an error
    if (responseData.errors && responseData.errors.length > 0) {
      const errorMessage = responseData.errors[0].message || "Unknown error";

      // Return consistent error structure
      return {
        statusCode: 400,
        message: `DHL API Error: ${errorMessage}`,
        partnerCode: this.partnerCode,
        metadata: {
          transporterId: "",
        },
        data: {
          originalResponse: responseData,
          requestUrl: requestUrl,
          requestBody: requestBody,
        },
        trace: {
          timestamp: new Date().toISOString(),
          partnerCode: this.partnerCode,
        },
      } as R;
    }

    // Map packages from request to shipmentDetails
    const requestPackages = requestBody?.content?.packages || [];
    const responsePackages = responseData.packages || [];
    
    const shipmentDetails = requestPackages.map((pkg: any, index: number) => ({
      awbNumber: pkg.customerReferences?.[0]?.value || null,
      partnerAwbNumber: responsePackages[index]?.trackingNumber || null,
      partnerName: "DHL",
      transporterId: "", // Blank for now as requested
    }));

    const documents = responseData.documents.map((doc: any, index: number) => ({
      content: doc.content,
      format: doc.imageFormat,
      type: doc.typeCode,
    }))
    shipmentDetails.push({documents:documents})

    return {
      statusCode: 200,
      message: "Order created successfully with DHL",
      partnerCode: this.partnerCode,
      metadata: {
        transporterId: "", // Blank for now as requested
      },
      data: {
        originalResponse: responseData,
        requestUrl: requestUrl,
        requestBody: requestBody,
        shipmentDetails: shipmentDetails
      },
      trace: {
        timestamp: new Date().toISOString(),
        partnerCode: this.partnerCode,
      },
    } as R;
  }
}
