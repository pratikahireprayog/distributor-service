import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";
import { parseStringPromise } from "xml2js";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { ARAMEXAuthService } from "./aramex-auth.service";
import { BaseOrderResDto, BaseReqDto, BaseResDto } from "src/common/dtos/base.dto";
import {
  BaseCancelOrderDtoV2,
  BaseOrderReqDtoV2,
} from "src/common/dtos/base2.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { AxiosResponse } from "axios";
import { ARAMEX_ACCOUNTS, ARAMEX_API_URLS, ARAMEX_CLIENT_INFO, ARAMEX_PAYMENT_METHOD, ARAMEX_PAYMENT_TYPE, ARAMEX_PRODUCT_TYPE, ORDER_TYPE } from "./aramex-constants";

@Injectable()
export class ARAMEXService extends BaseNetworkPartner {
  protected readonly logger = new Logger(ARAMEXService.name);
  private readonly httpsAgent: https.Agent;

  constructor(
    protected readonly authProvider: ARAMEXAuthService,
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.ARAMEX,
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
   * Create an order with ARAMEX
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends any>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    //  1 Fetch Endpoint for ARARMEX
    //  Keeping outside try box as it's getting access in catch block
    const endpoint = {
      url: this.configService.get<string>("ARAMEX_CREATE_ORDER_URL"),
    };

    try {

      // 2. Fetch city code using helper
      const pickupAddress: any =
        orderDetails.addresses?.find((a: any) => a.type === "PICKUP") || {};

      const pickupZip =
        pickupAddress.zip ||
        pickupAddress.postalCode ||
        pickupAddress.pincode ||
        pickupAddress.pin ||
        pickupAddress.PIN ||
        pickupAddress.PostCode ||
        pickupAddress.PINCODE;
      if (!pickupZip) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "Pickup address zip is required for ARAMEX account lookup"
        );
      }

      const cityCode = await this.fetchCityCodeFromZip(pickupZip);
      if (!cityCode) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Could not fetch city_code from nearest hub API`
        );
      }
      // 3. Fetch partner_id
      // let partnerId: string | undefined = undefined;
      // if (
      //   eligiblePartners &&
      //   Array.isArray(eligiblePartners.data) &&
      //   eligiblePartners.data.length > 0
      // ) {
      //   partnerId = String(eligiblePartners.data[0].id);
      // }
      // partnerId = this.configService.get<string>("ARAMEX_PARTNER_ID");
      // if (!partnerId) {
      //   throw new CustomHttpException(
      //     HttpStatus.BAD_REQUEST,
      //     "partner_id is required for ARAMEX partner-configs lookup"
      //   );
      // }

      // 4. Transform the payload for ARAMEX API, injecting the accountId
      const transformedData = await this.transformCreateAramexPayload(
        orderDetails, cityCode
      );

      // 6. Make API call
      const apiResult = await this.callAramexCreateOrderAPI(
        endpoint,
        transformedData
      );

      // 7. Format and return response
      return this.formatCreateOrderResponse<any>(apiResult);
    } catch (error) {
      this.logger.error(`ARAMEX createOrder error: ${JSON.stringify(error)}`);
      // Return consistent error structure for exceptions
      const errorResponse = {
        statusCode: error.status || error.response?.status || 500,
        message: `ARAMEX createOrder failed: ${error.message || "Unknown error"}`,
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


  async transformCreateAramexPayload(order, cityCode) {
    const shipperAddr = order.addresses.find(a => a.type === "PICKUP");
    const consigneeAddr = order.addresses.find(a => a.type === "DELIVERY");
    const clientInfo = await this.fetchAramexClientInfo(cityCode);
    const accountNumber = clientInfo.AccountNumber;

    const shipment = {
      Shipper: await this.convertAddressAndContactsToAramexParty(shipperAddr, accountNumber),
      Consignee: await this.convertAddressAndContactsToAramexParty(consigneeAddr, ""),
      ShippingDateTime: `/Date(${new Date(order.orderDate).getTime()}+0530)/`,
      DueDate: `/Date(${new Date(order.expectedDeliveryDate).getTime()}+0530)/`,
      Comments: order.parentShipment?.note || "",
      PickupLocation: "",
      OperationsInstructions: "",
      AccountingInstrcutions: "",
      Details: {
        Dimensions: order.parentShipment?.dimensions
          ? {
            Length: order.parentShipment.dimensions.length,
            Width: order.parentShipment.dimensions.width,
            Height: order.parentShipment.dimensions.height,
            Unit: "CM",
          }
          : null,
        ActualWeight: {
          Unit: "KG",
          Value: order.parentShipment?.physicalWeight || 0,
        },
        ChargeableWeight: null,
        DescriptionOfGoods: order.parcelCategory || "",
        GoodsOriginCountry: "IN",
        NumberOfPieces: order.parentShipment?.items?.length || 1,
        ProductGroup: order.orderType === ORDER_TYPE.FORWARD ? ORDER_TYPE.EXP : ORDER_TYPE.DOM,
        ProductType: ARAMEX_PRODUCT_TYPE.includes(order.productType) ? order.productType : null,
        PaymentType: 'P', // Prepaid Transportation Charges payable by shipper
        PaymentOptions: '', // Optional - Based on the Payment Type P

        /**  Value charged by destination customs.
          Conditional - Based on the ProductType "Dutible" **/
        CustomsValueAmount: {
          CurrencyCode: "INR",
          Value: (order.parentShipment?.items || []).reduce(
            (sum, i) => sum + (i.unitPrice || 0),
            0
          ),
        },

        /**  Amount of Cash that is paid by the receiver of the package.
          Conditional - Based on the Services "COD" being filled.  **/
        CashOnDeliveryAmount: null,

        /**. Transportation Charges to be collected from consignee.
        Conditional - Based on the PaymentType "C" +PaymentOptions "ARCC" */
        CollectAmount: null,
        CashAdditionalAmountDescription: "",

        Services: order.serviceType || "",
        Items: order.parentShipment?.items?.map(this.transformItem) || [],
        AdditionalProperties: [
          {
            "CategoryName": "CustomsClearance",
            "Name": "InvoiceDate",
            "Value": this.formatDateToMMDDYYYY(order.orderDate)
          },
          {
            "CategoryName": "CustomsClearance",
            "Name": "InvoiceNumber",
            "Value": `INV-${order.parentShipment?.awbNumber}` // creating custom invoice number
          },
          {
            "CategoryName": "CustomsClearance",
            "Name": "ExporterType",
            "Value": "UT"
          },
          {
            "CategoryName": "CustomsClearance",
            "Name": "ShipperTaxIdVATEINNumber",
            "Value": "535453366"
          },
        ],
      },
      ForeignHAWB: "",  // Clients Shipment number
      ScheduledDelivery: null,
    };
    // Fetch Label Information
    const labelInfo = await this.fetchLabelInfo();

    // Fetch Transactions Details
    const transactionDetails = await this.fetchTransactionsDetails();
    return {
      ClientInfo: clientInfo,
      LabelInfo: labelInfo,
      Shipments: [shipment],
      // Transaction: transactionDetails  // Optional
    };
  }

  private async fetchCityCodeFromZip(zip: string): Promise<string | undefined> {
    const url = this.configService.get<string>("SERVICEABILITY_HUB_CODE_URL");
    const nearestHubUrl = `${url}/${zip}`;
    const nearestHubResp = await firstValueFrom(
      this.httpService.get(nearestHubUrl)
    );
    return nearestHubResp?.data?.data?.hub_city_code;
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

  private async convertAddressAndContactsToAramexParty(addr, accountNumber = "") {
    return {
      Reference1: "",
      Reference2: "",
      AccountNumber: accountNumber,
      PartyAddress: {
        Line1: addr?.street || "",
        Line2: addr?.landmark || "",
        Line3: "",
        City: addr?.city || "",
        StateOrProvinceCode: addr?.state || "",
        PostCode: addr?.zip || "",
        CountryCode: await this.fetchAndValidateCountryCode(
          addr?.zip || addr?.postalCode || ""
        ),
        Longitude: addr?.longitude || 0,
        Latitude: addr?.latitude || 0,
        BuildingNumber: "",
        BuildingName: "",
        Floor: "",
        Apartment: "",
        POBox: null,
        Description: null,
      },
      Contact: {
        Department: "",
        PersonName: addr?.name || "",
        Title: "",
        CompanyName: addr?.addressName || addr?.name || "",
        PhoneNumber1: addr?.phone || "",
        PhoneNumber1Ext: "",
        PhoneNumber2: "",
        PhoneNumber2Ext: "",
        FaxNumber: "",
        CellPhone: addr?.phone || "",
        EmailAddress: addr?.email || "",
        Type: "",
      },
    }
  }

  private transformItem(item) {
    return {
      PackageType: item.name,
      Quantity: String(item.quantity || 1),
      Weight: item.weight != null || item.weight != ""
        ? { Value: item.weight, Unit: "KG" }
        : "",
      CustomsValue: {
        CurrencyCode: "INR", // need to check
        Value: item.unitPrice || 0,
      },
      Comments: "",
      GoodsDescription: item.description || "",
      Reference: item.sku || "",
      CommodityCode: item.hsnCode || "",
    };
  }

  private async fetchAramexClientInfo(city) {
    const account = await this.getAramexAccountByCity(city);
    return {
      UserName: this.configService.get<string>("ARAMEX_USER_NAME"),
      Password: this.configService.get<string>("ARAMEX_USER_PASSWORD"),
      Version: ARAMEX_CLIENT_INFO.VERSION,
      Source: ARAMEX_CLIENT_INFO.SOURCE,
      ...account
    }
  }

  private async fetchLabelInfo() {
    return {
      ReportID: 9729,
      ReportType: "URL",
    }
  }

  private async fetchTransactionsDetails() {
    return {
      Reference1: "",
      Reference2: "",
      Reference3: "",
      Reference4: "",
      Reference5: "",
    }
  }

  private async callAramexCreateOrderAPI(
    endpoint: any,
    payload: any
  ): Promise<{
    response: AxiosResponse<any>;
    requestUrl: string;
    requestBody: any;
  }> {

    const requestUrl = `${endpoint.url}?strictValidation=false&bypassPLTError=false&validateDataOnly=false`;

    try {
      // Generate message reference with proper length (28-36 characters)
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 10);
      const messageReference = `aramex-${timestamp}-${randomId}`; // Ensures 28+ characters
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
            Authorization: `Basic ${this.configService.get<string>("ARAMEX_AUTH_TOKEN")}`,
            "Content-Type": "application/json",
          },
          httpsAgent: this.httpsAgent,
          timeout: 30000,
        })
      );

      return { response, requestUrl, requestBody: payload };
    } catch (error) {
      // Attach request details to error for consistent error handling
      (error as any).requestUrl = requestUrl;
      (error as any).requestBody = payload;
      throw error;
    }
  }

  // Format Create Order API Response
  private async formatCreateOrderResponse<R extends BaseOrderResDto>(apiResult: {
    response: AxiosResponse<any>;
    requestUrl: string;
    requestBody: any;
  }): Promise<R> {
    const { response, requestUrl, requestBody } = apiResult;

    let responseData = response.data;

    // If XML, parse to JSON
    if (typeof responseData === "string" && responseData.startsWith("<")) {
      responseData = await parseStringPromise(responseData, { explicitArray: false });
    }

    // Navigate Aramex response safely
    const root = responseData["ShipmentCreationResponse"];
    const hasErrors = root?.HasErrors === "true" || root?.HasErrors === true;

    if (hasErrors) {
      const errors = root?.Notifications?.Notification;
      const errorMessage = errors
        ? Array.isArray(errors)
          ? errors[0]?.Message
          : errors?.Message
        : "Unknown Aramex error";

      return {
        statusCode: 400,
        message: `Aramex API Error: ${errorMessage}`,
        data: {
          originalResponse: responseData,
          requestUrl,
          requestBody,
        },
        trace: {
          timestamp: new Date().toISOString(),
          partnerCode: this.partnerCode,
        },
      } as R;
    }

    const processedShipment = root?.Shipments?.ProcessedShipment;
    const trackingId = processedShipment?.ID;
    const labelUrl = processedShipment?.ShipmentLabel?.LabelURL;

    return {
      statusCode: 200,
      message: "Order created successfully with Aramex",
      data: {
        originalResponse: responseData,
        requestUrl,
        requestBody,
        trackingId,
        referenceNumber: trackingId,
        labelUrl,
        shipmentDetails: processedShipment?.ShipmentDetails,
      },
      trace: {
        timestamp: new Date().toISOString(),
        partnerCode: this.partnerCode,
      },
    } as R;
  }


  private async getAramexAccountByCity(city: string) {
    const normalized = city.trim().toUpperCase();

    if (["DELHI", "NEW DELHI", "DEL"].includes(normalized)) return ARAMEX_ACCOUNTS.DELHI;
    if (["BENGALURU", "BANGALORE", "BLR"].includes(normalized)) return ARAMEX_ACCOUNTS.BLR;
    if (["HYDERABAD", "HYD"].includes(normalized)) return ARAMEX_ACCOUNTS.HYD;
    if (["MUMBAI", "BOMBAY", "THANE", "BOM"].includes(normalized)) return ARAMEX_ACCOUNTS.BOM;
    if (["AHMEDABAD", "AMD"].includes(normalized)) return ARAMEX_ACCOUNTS.AMD;
    if (["CHENNAI", "MAA"].includes(normalized)) return ARAMEX_ACCOUNTS.CHENNAI;

    throw new Error(`No Aramex account configured for city: ${city}`);
  }

  private formatDateToMMDDYYYY(dateString: string): string {
    const date = new Date(dateString);

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
  }


  /**
   * Create pickup request V2 with ARAMEX
   */
  async createPickupV2<T extends BaseReqDto, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.debug(`Creating Pickup V2 with ARANEX for partner: ${partnerCode}`);
    const startTime = Date.now();

    try {
      // Validate input
      if (!data) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Pickup data is required'
        );
      }

      const pickupAddress: any = data['Pickup']['PickupAddress'];

      const pickupZip =
        pickupAddress.zip ||
        pickupAddress.postalCode ||
        pickupAddress.pincode ||
        pickupAddress.pin ||
        pickupAddress.PIN ||
        pickupAddress.PostCode ||
        pickupAddress.PINCODE;

      if (!pickupZip) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "Pickup address zip is required for ARAMEX account lookup"
        );
      }

      const cityCode = await this.fetchCityCodeFromZip(pickupZip);
      const clientInfo = await this.fetchAramexClientInfo(cityCode);

      const aramexPickupShipmentPayload = { ...clientInfo, ...data }
      // Build the URL from environment variable
      const baseUrl = this.configService.get<string>('ARAMEX_BASE_URL');
      const pickupUrl = `${baseUrl}/${ARAMEX_API_URLS.ARAMEX_PICKUP_SHIPEMENT_URL}`;
      if (!baseUrl) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'ARAMEX_BASE_URL environment variable is not configured'
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
        this.httpService.post(pickupUrl, aramexPickupShipmentPayload, {
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
        message: "Pickup created successfully with ARAMEX",
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
      this.logger.error(`ARAMEX createPickup error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      const endpoint = {
        url: `${this.configService.get<string>('ARAMEX_BASE_URL')}/${ARAMEX_API_URLS.ARAMEX_CANCEL_ORDER_URL}`
      };
      if (!endpoint.url) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'ARAMEX_BASE_URL environment variable is not configured'
        );
      }
      const clientInfo = await this.fetchAramexClientInfo('BOM'); //   NEED to check

      const authHeaders = await this.authProvider.getAuthHeaders();
      const holdShipmentPayload = {
        ClientInfo: clientInfo,
        ShipmentHolds: data.cAwbNumbers.map(awb => ({
          ShipmentNumber: awb,
          Comment: data?.cancelReason || ''
        }))
      };

      const response = await firstValueFrom(
        this.httpService.post(endpoint.url, holdShipmentPayload, {
          headers: authHeaders,
          httpsAgent: this.httpsAgent,
          timeout: 30000,
        })
      );
      return {
        statusCode: 200,
        message: "Order cancelled successfully with ARAMEX",
        data: response.data
      } as R;
    } catch (error) {
      this.logger.error(`ARAMEX cancelOrder error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

}
