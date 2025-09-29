import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { BaseOrderResDto } from "src/common/dtos/base.dto";
import { BaseOrderReqDtoV2 } from "src/common/dtos/base2.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { ACCOUNT_DETAILS, FEDEX_URLS } from "./fedex-constants";

@Injectable()
export class FEDEXConsolidationService extends BaseNetworkPartner {
  protected readonly logger = new Logger(FEDEXConsolidationService.name);
  private readonly httpsAgent: https.Agent;

  constructor(
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
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
      const consolidationBody = await this.transformCreateFedexConsolidationPayload(orderDetails);

      // 2. Create Consolidation
      console.log("FEDEX_URLS.CREATE_CONSOLIDATION", FEDEX_URLS.CREATE_CONSOLIDATION);
      const consolidationRes = await this.callFedexAPI(
        FEDEX_URLS.CREATE_CONSOLIDATION,
        consolidationBody
      );

      const consolidationKey = consolidationRes?.data?.output?.consolidationKey;
      if (!consolidationKey) {
        throw new CustomHttpException(HttpStatus.BAD_REQUEST, "FedEx consolidationKey not returned");
      }

      // 3. Transform payload for consolidation shipment
      const shipmentBody = await this.transformCreateFedexShipmentPayload(orderDetails, consolidationKey);

      console.log("shipmentBody", shipmentBody);
      // 4. Create Consolidation Shipment
      const shipmentRes = await this.callFedexAPI(
        FEDEX_URLS.CREATE_CONSOLIDATION_SHIPMENT,
        shipmentBody
      );

      // 5. Format and return
      return this.formatCreateOrderResponse<any>({
        consolidation: consolidationRes.data,
        shipment: shipmentRes.data,
      });

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

  /**
   * Map CreateOrderV2 payload → FedEx Consolidation
   */
  private async transformCreateFedexConsolidationPayload(order: BaseOrderReqDtoV2) {
    const pickup = order.addresses.find(a => a.type === "PICKUP");
    const delivery = order.addresses.find(a => a.type === "DELIVERY");

    return {
      consolidationIndex: "IDX-" + Date.now(),
      requestedConsolidation: {
        consolidationType: "INTERNATIONAL_ECONOMY_DISTRIBUTION",
        shipDate: new Date(order.orderDate).toISOString().split("T")[0],
        shipper: {
          address: {
            streetLines: [pickup.street],
            city: pickup.city,
            postalCode: pickup.zip,
            countryCode: "IN",
          },
          contact: {
            personName: pickup.name,
            phoneNumber: pickup.phone,
            emailAddress: pickup.email,
          },
        },
        soldTo: {
          address: {
            streetLines: [delivery.street],
            city: delivery.city,
            postalCode: delivery.zip,
            countryCode: delivery.country,
          },
          contact: {
            personName: delivery.name,
            phoneNumber: delivery.phone,
          },
        },
        bookingNumber: order.orderId,
        description: order.parentShipment?.items?.map(i => i.name).join(", "),
        labelSpecification: {
          labelFormatType: "COMMON2D",
          imageType: "PDF",
          labelStockType: "PAPER_85X11",
        },
      },
      accountNumber: {
        value: this.configService.get<string>("FEDEX_ACCOUNT_NUMBER"),
      },
    };
  }

  /**
   * Map CreateOrderV2 payload → FedEx Consolidation Shipment
   */
  private async transformCreateFedexShipmentPayload(order: BaseOrderReqDtoV2, consolidationKey: string) {
    const pickup = order.addresses.find(a => a.type === "PICKUP");
    const delivery = order.addresses.find(a => a.type === "DELIVERY");
    const shipment = order.parentShipment;

    // const cityCode = await this.fetchCityCodeFromZip(pickupZip);
    // if (!cityCode) {
    //   throw new CustomHttpException(
    //     HttpStatus.BAD_REQUEST,
    //     `Could not fetch city_code from nearest hub API`
    //   );
    // }

    const account = await this.getAccountNumberForFedex('', '');

    return {
      accountNumber: {
        value: '202947575' //this.configService.get<string>("FEDEX_ACCOUNT_NUMBER"),
      },
      consolidationKey,
      processingOptionType: "ALLOW_ASYNCHRONOUS",
      shipAction: "CONFIRM",
      requestedShipment: {
        shipDatestamp: new Date(order.orderDate).toISOString(),
        dropOffType: "REGULAR_PICKUP",
        serviceType: "INTERNATIONAL_PRIORITY_DISTRIBUTION",
        packagingType: "YOUR_PACKAGING",
        totalWeight: {
          units: "KG",
          value: shipment?.physicalWeight || 1,
        },
        shipper: {
          address: {
            streetLines: [pickup.street],
            city: pickup.city,
            postalCode: pickup.zip,
            countryCode: "IN",
          },
          contact: {
            personName: pickup.name,
            phoneNumber: pickup.phone,
          },
        },
        recipients: [
          {
            address: {
              streetLines: [delivery.street],
              city: delivery.city,
              postalCode: delivery.zip,
              countryCode: delivery.country,
            },
            contact: {
              personName: delivery.name,
              phoneNumber: delivery.phone,
            },
          },
        ],
        customsClearanceDetail: {
          commodities: shipment.items.map(item => ({
            description: item.name,
            quantity: item.quantity,
            weight: { units: "KG", value: item.weight || 0.1 },
            customsValue: { currency: "INR", amount: item.unitPrice || 0 },
          })),
        },
        packageCount: shipment.items.length || 1,
        requestedPackageLineItems: [
          {
            weight: { units: "KG", value: shipment.physicalWeight || 1 },
            dimensions: {
              length: shipment.dimensions?.length || 1,
              width: shipment.dimensions?.width || 1,
              height: shipment.dimensions?.height || 1,
              units: "CM",
            },
          },
        ],
      },
    };
  }

  /**
   * Make FedEx API call with OAuth2 token
   */
  private async callFedexAPI(url: string, body: any) {
    const token = await this.fetchFedexAuthToken();

    const response = await firstValueFrom(
      this.httpService.put(url, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        httpsAgent: this.httpsAgent,
        timeout: 30000,
      })
    );

    return response;
  }


  /**
   * Fetch OAuth token from FedEx
   */
  private async fetchFedexAuthToken(): Promise<string> {
    const authUrl = this.configService.get<string>("FEDEX_AUTH_URL");
    const clientId = this.configService.get<string>("FEDEX_CLIENT_ID");
    const clientSecret = this.configService.get<string>("FEDEX_CLIENT_SECRET");

    const resp = await firstValueFrom(
      this.httpService.post(
        authUrl,
        new URLSearchParams({ grant_type: "client_credentials" }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          auth: { username: clientId, password: clientSecret },
        }
      )
    );
    return resp.data.access_token;
  }

  /**
   * Format response for uniformity
   */
  private async formatCreateOrderResponse<R extends BaseOrderResDto>(apiResult: any): Promise<R> {
    const trackingId = apiResult.shipment?.output?.transactionShipments?.[0]?.masterTrackingNumber;
    const labelDoc = apiResult.shipment?.output?.transactionShipments?.[0]?.pieceResponses?.[0]?.packageDocuments?.[0];
    const labelUrl = labelDoc?.url;

    return {
      statusCode: 200,
      message: "Order created successfully with FedEx",
      data: {
        originalResponse: apiResult,
        trackingId,
        referenceNumber: trackingId,
        labelUrl,
      },
      trace: {
        timestamp: new Date().toISOString(),
        partnerCode: this.partnerCode,
      },
    } as R;
  }

  private async getAccountNumberForFedex(location: string, network: string) {
    return ACCOUNT_DETAILS.filter(
      account => account.location === location && account.network === network
    );
  }
}
