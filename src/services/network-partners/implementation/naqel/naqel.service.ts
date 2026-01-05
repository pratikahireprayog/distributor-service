import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from "https";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import {
  BaseOrderReqDtoV2,
  BaseCancelOrderDtoV2,
} from "src/common/dtos/base2.dto";
import { BaseReqDto, BaseResDto } from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import axios from "axios";
import * as xml2js from "xml2js";
import { naqelCityList } from "./naqel_country_codes";
import { CITYCODE_CURRENCY_MAPPING } from "./naqel.constants";

@Injectable()
export class NAQELService extends BaseNetworkPartner {
  protected readonly logger = new Logger(NAQELService.name);
  private readonly httpsAgent: https.Agent;

  constructor(
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>,
  ) {
    super(PARTNER_CODE_ENUM.NAQEL, null, httpService, endpointConfigRepository, schemaMapper);

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 20,
      timeout: 60000,
    });
  }

  /**
   * -------------------------------
   * Create Order (Waybill)
   * -------------------------------
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      const wsdlUrl = this.configService.get<string>("NAQEL_BASE_URL");
      const apiUser = this.configService.get<string>("NAQEL_CLIENT_ID");
      const apiPass = this.configService.get<string>("NAQEL_PASSWORD");

      const xmlRequest = await this.buildCreateWaybillXML(orderDetails, apiUser, apiPass);
      const response = await firstValueFrom(
         this.httpService.post(wsdlUrl, xmlRequest, {
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "http://tempuri.org/CreateWaybill"
          },
          httpsAgent: this.httpsAgent,
          timeout: 45000,
          })
        );

      const jsonResponse = await this.parseXML(response.data);
      const waybillNumber = jsonResponse?.["soap:Envelope"]?.["soap:Body"]?.["CreateWaybillResponse"]?.["CreateWaybillResult"]?.["WaybillNo"];
      const labelBase64 = await this.generateNaqelLabel(waybillNumber, orderDetails);

      // Extract AWB number from order details
      const awbNumber = orderDetails?.parentShipment?.awbNumber || 
                       orderDetails?.awbNumber || 
                       orderDetails?.orderId ||
                       '';

      return {
        statusCode: 200,
        message: "NAQEL shipment created successfully",
        partnerCode: this.partnerCode,
        data: {
          originalResponse: jsonResponse,
          trackingId: waybillNumber || "",
          referenceNumber: waybillNumber || "",
          cAwbNumber: waybillNumber || "",
          // label: labelBase64,
          shipmentDetails: {
            trackingDetails: [
              {
                awbNumber: awbNumber,
                partnerAwbNumber: waybillNumber || '',
                partnerName: PARTNER_CODE_ENUM.NAQEL,
                transporterId: 'NAQEL',
              },
            ],
            documents: labelBase64 ? [
              {
                content: labelBase64,
                type: 'label',
                format: 'base64',
              },
            ] : [],
          },
        },
        trace: {
          timestamp: new Date().toISOString(),
          partnerCode: this.partnerCode,
        },
      } as R;
    } catch (error) {
      this.logger.error(`NAQEL createOrder error: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `NAQEL createOrder failed: ${error.message}`
      );
    }
  }

  /**
   * -------------------------------
   * Cancel Order (Waybill)
   * -------------------------------
   */
  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      const wsdlUrl = this.configService.get<string>("NAQEL_BASE_URL");
      const apiUser = this.configService.get<string>("NAQEL_CLIENT_ID");
      const apiPass = this.configService.get<string>("NAQEL_PASSWORD");

      const awbNumber =
        data.partnerOrderId ||
        data.cAwbNumbers?.[0] ||
        data.orderId ||
        '';
      if (!awbNumber) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "AWB/partnerOrderId is required to cancel order"
        );
      }

      const xmlRequest = this.buildCancelWaybillXML(awbNumber, apiUser, apiPass);

      const response = await firstValueFrom(
        this.httpService.post(wsdlUrl, xmlRequest, {
          headers: { "Content-Type": "text/xml; charset=utf-8" },
          httpsAgent: this.httpsAgent,
          timeout: 30000,
        })
      );

      const jsonResponse = await this.parseXML(response.data);
      const status = jsonResponse?.Envelope?.Body?.CancelWaybillResponse?.CancelWaybillResult?.IsCancelled;

      return {
        statusCode: 200,
        message: status ? "Order cancelled successfully with NAQEL" : "Failed to cancel NAQEL order",
        data: jsonResponse,
      } as R;
    } catch (error) {
      this.logger.error(`NAQEL cancelOrder error: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `NAQEL cancelOrder failed: ${error.message}`
      );
    }
  }
private async generateNaqelLabel(waybillNumber: string, orderDetails: any): Promise<string | null> {
  try {
    const wsdlUrl = this.configService.get<string>("NAQEL_BASE_URL");
    const apiUser = this.configService.get<string>("NAQEL_CLIENT_ID");
    const apiPass = this.configService.get<string>("NAQEL_PASSWORD");

    // Get pickup address from order details
    const pickupAddress = orderDetails.addresses?.find((a: any) => a.type === "PICKUP");
    if (!pickupAddress) {
      this.logger.error("Pickup address not found in order details");
      return null;
    }

    // Check serviceability in database - this will return locations with country codes from database
    // CityCode is considered as zip code
    const sourceCityCode = pickupAddress.zip;
    if (!sourceCityCode) {
      this.logger.error("Source city code (zip) not found in pickup address");
      return null;
    }

    // For label generation, we only need source location (pickup)
    // Query source location from naqel_cities table (using static list for now, can be replaced with DB query)
    // In database: WHERE city_code = ? AND is_serviceable = true
    const sourceLocation = naqelCityList.find(
      (c) => c.CityCode.toLowerCase() === sourceCityCode?.toLowerCase()
    );
    
    if (!sourceLocation) {
      this.logger.error(`Source city code ${sourceCityCode} not found or not serviceable`);
      return null;
    }

    // Extract country code from database location (from naqel_cities table)
    const sourceCountryCode = sourceLocation.CountryCode;

    const labelXml = `<?xml version="1.0" encoding="utf-8"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <GetWaybillSticker xmlns="http://tempuri.org/">
            <clientInfo>
              <ClientAddress>
                <PhoneNumber>${pickupAddress.phone || ''}</PhoneNumber>
                <NationalAddress>${escapeXml(pickupAddress.street || '')}</NationalAddress>
                <POBox>0</POBox>
                <ZipCode>0</ZipCode>
                <Fax/>
                <Latitude>${pickupAddress.latitude || ''}</Latitude>
                <Longitude>${pickupAddress.longitude || ''}</Longitude>
                <ShipperName>${escapeXml(pickupAddress.name || "shipper")}</ShipperName>
                <FirstAddress>${escapeXml(pickupAddress.street || "")}</FirstAddress>
                <Location>${escapeXml(pickupAddress.city || "")}</Location>
                <CountryCode>${sourceCountryCode}</CountryCode>
                <CityCode>${pickupAddress.zip || ""}</CityCode>
              </ClientAddress>
              <ClientContact>
                <Name>${escapeXml(pickupAddress.name || "Shipper Name")}</Name>
                <Email>${pickupAddress.email || "shipper@example.com"}</Email>
                <PhoneNumber>${pickupAddress.phone || ''}</PhoneNumber>
                <MobileNo>${pickupAddress.phone || ''}</MobileNo>
              </ClientContact>
              <ClientID>${apiUser}</ClientID>
              <Password>${apiPass}</Password>
              <Version>9.0</Version>
            </clientInfo>
            <WaybillNo>${waybillNumber}</WaybillNo>
            <StickerSize>ExpressLabel4x6Inches</StickerSize>
          </GetWaybillSticker>
        </soap:Body>
      </soap:Envelope>`;


    const response = await firstValueFrom(
      this.httpService.post(wsdlUrl, labelXml, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": "http://tempuri.org/GetWaybillSticker",
        },
        httpsAgent: this.httpsAgent,
        timeout: 30000,
      })
    );
    const labelJson = await this.parseXML(response.data);
    const base64Label =
      labelJson?.["soap:Envelope"]?.["soap:Body"]?.["GetWaybillStickerResponse"]?.["GetWaybillStickerResult"] || null;

    return base64Label || null;
  } catch (err) {
    this.logger.error(`NAQEL label generation failed: ${err.message}`);
    return null;
  }
}


  /**
   * Check serviceability in database - this will return locations with country codes from database
   * CityCode is considered as zip code
   * TODO: Replace with actual database query when repository is implemented
   * The database query should check: WHERE city_code = ? AND is_serviceable = true
   */
  private async checkServiceabilityByCityCodes(
    sourceCityCode: string,
    destCityCode: string
  ): Promise<{ sourceLocation: any; destLocation: any }> {
    // Query source location from naqel_cities table (using static list for now, can be replaced with DB query)
    // In database: WHERE city_code = ? AND is_serviceable = true
    const sourceLocation = naqelCityList.find(
      (c) => c.CityCode.toLowerCase() === sourceCityCode?.toLowerCase()
    );
    
    if (!sourceLocation) {
      throw new Error(
        `Source city code ${sourceCityCode} not found or not serviceable`
      );
    }

    // Query destination location from naqel_cities table
    // In database: WHERE city_code = ? AND is_serviceable = true
    const destLocation = naqelCityList.find(
      (c) => c.CityCode.toLowerCase() === destCityCode?.toLowerCase()
    );

    if (!destLocation) {
      throw new Error(
        `Destination city code ${destCityCode} not found or not serviceable`
      );
    }

    return { sourceLocation, destLocation };
  }

  private async buildCreateWaybillXML(orderDetails: any, apiUser: string, apiPass: string): Promise<string> {
  const pickupAddress = orderDetails.addresses.find(a => a.type === "PICKUP");
  const deliveryAddress = orderDetails.addresses.find(a => a.type === "DELIVERY");
  const invoice = orderDetails.documents.find(d => d.type === "commercial_invoice");
  const totalCost = orderDetails.parentShipment.items.reduce((sum, i) => sum + Number(i.unitPrice || 0), 0);
  // Check serviceability in database - this will return locations with country codes from database
  // CityCode is considered as zip code
  const sourceCityCode = pickupAddress.zip;
  const destCityCode = deliveryAddress.zip;
  
  const { sourceLocation, destLocation } = await this.checkServiceabilityByCityCodes(
    sourceCityCode,
    destCityCode
  );

  // Extract country codes from database locations (from naqel_cities table)
  const sourceCountryCode = sourceLocation.CountryCode;
  const destCountryCode = destLocation.CountryCode;
    
  const currencyCode = orderDetails?.payment?.currency;
  const currencyId = getCurrencyId(currencyCode);
  
  const orderType = orderDetails.serviceType; 
  const loadTypeId = mapServiceToLoadTypeID(orderType, sourceCountryCode, destCountryCode)

    
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Header/>
    <soapenv:Body>
        <CreateWaybill xmlns="http://tempuri.org/">
            <_ManifestShipmentDetails>
                <ClientInfo>
                    <ClientAddress>
                        <PhoneNumber>${pickupAddress.phone || '0000000000'}</PhoneNumber>
                        <POBox>0</POBox>
                        <ZipCode>0</ZipCode>
                        <Fax>0</Fax>
                        <FirstAddress>${escapeXml(pickupAddress.street)}</FirstAddress>
                        <Location>${escapeXml(pickupAddress.city)}</Location>
                        <CountryCode>${sourceCountryCode}</CountryCode>
                        <CityCode>${pickupAddress.zip}</CityCode>
                    </ClientAddress>
                    <ClientContact>
                        <Name>${escapeXml(pickupAddress.name)}</Name>
                        <Email>${pickupAddress.email || 'no-email@example.com'}</Email>
                        <PhoneNumber>${pickupAddress.phone}</PhoneNumber>
                        <MobileNo>${pickupAddress.phone}</MobileNo>
                    </ClientContact>
                    <ClientID>${apiUser}</ClientID>
                    <Password>${apiPass}</Password>
                    <Version>9.0</Version>
                </ClientInfo>
                <ConsigneeInfo>
                    <ConsigneeName>${escapeXml(deliveryAddress.name)}</ConsigneeName>
                    <Email>${deliveryAddress.email || ''}</Email>
                    <Mobile>${deliveryAddress.phone}</Mobile>
                    <PhoneNumber>${deliveryAddress.phone}</PhoneNumber>
                    <Fax></Fax>
                    <Address>${escapeXml(deliveryAddress.street)}</Address>
                    <Near>${escapeXml(deliveryAddress.landmark)}</Near>
                    <CountryCode>${destCountryCode}</CountryCode>
                    <CityCode>${deliveryAddress.zip}</CityCode>
                </ConsigneeInfo>
                <_CommercialInvoice>
                    <RefNo>TestHSCodeInvoice100</RefNo>
                    <InvoiceNo>${invoice?.id || ''}</InvoiceNo>
                    <InvoiceDate>${new Date().toISOString().split('T')[0]}</InvoiceDate>
                    <Consignee>${escapeXml(deliveryAddress.name)}</Consignee>
                    <ConsigneeAddress>${escapeXml(deliveryAddress.street)}</ConsigneeAddress>
                    <ConsigneeEmail>${deliveryAddress.email || ''}</ConsigneeEmail>
                    <MobileNo>${deliveryAddress.phone}</MobileNo>
                    <Phone>${deliveryAddress.phone}</Phone>
                    <TotalCost>${totalCost}</TotalCost>
                    <CurrencyCode>${destCountryCode}</CurrencyCode>
                    <CommercialInvoiceDetailList>
                        ${orderDetails.parentShipment.items.map(item => `
                        <CommercialInvoiceDetail>
                            <Quantity>${item.quantity}</Quantity>
                            <UnitType>KG</UnitType>
                            <CountryofManufacture>${destCountryCode}</CountryofManufacture>
                            <Description>${escapeXml(item.name)}</Description>
                            <ChineseDescription>${escapeXml(item.name)}</ChineseDescription>
                            <UnitCost>${item.unitPrice}</UnitCost>
                            <CustomsCommodityCode>${item.hsnCode}</CustomsCommodityCode>
                            <Currency>${orderDetails?.payment?.currency || "USD"}</Currency>
                        </CommercialInvoiceDetail>
                        `).join('')}
                    </CommercialInvoiceDetailList>
                </_CommercialInvoice>
                <CurrenyID>${currencyId}</CurrenyID>
                <BillingType>5</BillingType>
                <PicesCount>${orderDetails.parentShipment.items.reduce((sum, item) => sum + parseInt(item.quantity), 0)}</PicesCount>
                <Weight>${orderDetails.parentShipment.physicalWeight || orderDetails.parentShipment.items.reduce((sum, item) => sum + parseFloat(item.weight), 0)}</Weight>
                <DeliveryInstruction>${orderDetails.parentShipment.note || ''}</DeliveryInstruction>
                <CODCharge>1</CODCharge>   
                <CreateBooking>false</CreateBooking>
                <isRTO>false</isRTO>
                <GeneratePiecesBarCodes>true</GeneratePiecesBarCodes>
                <LoadTypeID>${loadTypeId}</LoadTypeID>
                <DeclareValue>${totalCost}</DeclareValue>
                <GoodDesc>${orderDetails.parentShipment.items.map(item => item.name).join(', ')}</GoodDesc>
                <Latitude>${deliveryAddress.latitude || ''}</Latitude>
                <Longitude>${deliveryAddress.longitude || ''}</Longitude>
                <RefNo>${orderDetails.orderId}</RefNo>
                <InsuredValue>0</InsuredValue>
                <IsInsurance>false</IsInsurance>
                <Reference1>${orderDetails.referenceId || ''}</Reference1>
                <Reference2></Reference2>
                <GoodsVATAmount>0</GoodsVATAmount>
                <IsCustomDutyPayByConsignee>false</IsCustomDutyPayByConsignee>
            </_ManifestShipmentDetails>
        </CreateWaybill>
    </soapenv:Body>
</soapenv:Envelope>`;
}

// <ConsigneeNationalID>0</ConsigneeNationalID> optional


  /**
   * Build XML for cancelling shipment
   */
  private buildCancelWaybillXML(awb: string, username: string, password: string): string {
    return `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
        <soapenv:Header/>
        <soapenv:Body>
          <tem:CancelWaybill>
            <tem:clientInfo>
              <tem:ClientCode>${username}</tem:ClientCode>
              <tem:Password>${password}</tem:Password>
            </tem:clientInfo>
            <tem:waybillNo>${awb}</tem:waybillNo>
          </tem:CancelWaybill>
        </soapenv:Body>
      </soapenv:Envelope>`;
  }

  /**
   * Parse XML to JSON
   */
  private async parseXML(xml: string): Promise<any> {
    return new Promise((resolve, reject) => {
      xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  /**
 * -------------------------------
 * Create Pickup
 * -------------------------------
 */
async createPickupV2<T extends BaseReqDto, R extends BaseResDto>(
  data: T,
  partnerCode: string,
  eligiblePartners?: EligiblePartnersData
): Promise<R> {
  this.logger.debug(`Creating Pickup V2 with NAQEL for partner: ${partnerCode}`);
  const startTime = Date.now();

  try {
    if (!data) {
      throw new CustomHttpException(HttpStatus.BAD_REQUEST, "Pickup data is required");
    }

    const wsdlUrl = this.configService.get<string>("NAQEL_BASE_URL");
    const apiUser = this.configService.get<string>("NAQEL_CLIENT_ID");
    const apiPass = this.configService.get<string>("NAQEL_PASSWORD");

    // Build CreateBooking XML
    const xmlRequest = await this.buildCreateBookingXML(data, apiUser, apiPass);
    const response = await firstValueFrom(
      this.httpService.post(wsdlUrl, xmlRequest, {
        headers: {
           "Content-Type": "text/xml; charset=utf-8",
           "SOAPAction": "http://tempuri.org/CreateBooking",
        },
        httpsAgent: this.httpsAgent,
        timeout: 45000,
      })
    );

    const jsonResponse = await this.parseXML(response.data);
    const bookingResult =
      jsonResponse?.Envelope?.Body?.CreateBookingResponse?.CreateBookingResult;

    const responseTimeMs = Date.now() - startTime;
    this.logger.debug(`Pickup created successfully in ${responseTimeMs}ms`);

    return {
      statusCode: 200,
      message: "Pickup created successfully with NAQEL",
      partnerCode: this.partnerCode,
      data: {
        success: true,
        pickupId: bookingResult?.BookingRefNo || "",
        status: "PICKUP_CREATED",
        message: bookingResult?.Message || "Pickup created successfully",
        apiResponse: jsonResponse,
      },
      trace: {
        timestamp: new Date().toISOString(),
        partnerCode: this.partnerCode,
        operation: "CREATE_PICKUP",
      },
    } as R;
  } catch (error) {
    this.logger.error(`NAQEL createPickup error: ${error.message}`);
    throw new CustomHttpException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      `NAQEL createPickup failed: ${error.message}`
    );
  }
}

  private async buildCreateBookingXML(order: any, username: string, password: string): Promise<string> {
  const shipper = order.addresses?.find(a => a.type === "PICKUP");
  const receiver = order.addresses?.find(a => a.type === "DELIVERY");

  const shipperCityCode = shipper?.postal_code;
  const receiverCityCode = receiver?.postal_code;
  
  // Check serviceability in database - this will return locations with country codes from database
  // CityCode is considered as zip code
  const { sourceLocation, destLocation } = await this.checkServiceabilityByCityCodes(
    shipperCityCode,
    receiverCityCode
  );

  // Extract country codes from database locations (from naqel_cities table)
  const sourceCountryCode = sourceLocation.CountryCode;
  const destCountryCode = destLocation.CountryCode;
    
  const originStationId = getStationIdByCityCode(shipperCityCode);
  const destinationStationId = getStationIdByCityCode(receiverCityCode);

  
  return `
  <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <CreateBooking xmlns="http://tempuri.org/">
        <_BookingShipmentDetail>
          <ClientInfo>
            <ClientAddress>
              <PhoneNumber>${shipper?.phone || ""}</PhoneNumber>
              <NationalAddress>${shipper?.street || ""}</NationalAddress>
              <ZipCode>${shipper?.zip || 0}</ZipCode>
              <ShipperName>${shipper?.name || ""}</ShipperName>
              <FirstAddress>${shipper?.street || ""}</FirstAddress>
              <Location>${shipper?.city || ""}</Location>
              <CountryCode>${sourceCountryCode}</CountryCode>
              <CityCode>${shipper?.postal_code || ""}</CityCode>
            </ClientAddress>
            <ClientContact>
              <Name>${shipper?.contactPerson || ""}</Name>
              <Email>${shipper?.email || ""}</Email>
              <PhoneNumber>${shipper?.phone || ""}</PhoneNumber>
              <MobileNo>${shipper?.phone || ""}</MobileNo>
            </ClientContact>
            <ClientID>${username}</ClientID>
            <Password>${password}</Password>
            <Version>9.0</Version>
          </ClientInfo>
          <BillingType>1</BillingType>
          <PickUpReqDateTime>${new Date().toISOString()}</PickUpReqDateTime>
          <PicesCount>${order.parentShipment?.items?.length || 1}</PicesCount>
          <Weight>${order.parentShipment?.weight || 1}</Weight>
          <PickUpPoint>${shipper?.address1 || ""}</PickUpPoint>
          <SpecialInstruction>${order?.remarks || ""}</SpecialInstruction>
          <OriginStationID>${originStationId}</OriginStationID>
          <DestinationStationID>${destinationStationId}</DestinationStationID>
          <OfficeUpTo>${new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()}</OfficeUpTo>
          <ContactPerson>${shipper?.contactPerson || ""}</ContactPerson>
          <ContactNumber>${shipper?.phone || ""}</ContactNumber>
          <LoadTypeID>34</LoadTypeID>
        </_BookingShipmentDetail>
      </CreateBooking>
    </soap:Body>
  </soap:Envelope>`;
}

}

function getStationIdByCityCode(cityCode: string): number | null {
  const city = naqelCityList.find(
    (c) => c.CityCode.toLowerCase() === cityCode.toLowerCase()
  );
  return city ? city.StationID : null;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function getCurrencyId(currencyCode: string): number {
  const currency = CITYCODE_CURRENCY_MAPPING.find(
    (c) => c.code.toUpperCase() === currencyCode.toUpperCase()
  );
  return currency ? currency.ID : 4; 
}

function mapServiceToLoadTypeID(serviceType, originCountry, destCountry) {
  if (!serviceType || !originCountry || !destCountry) return 36; 

  const isInternational = originCountry.toUpperCase() !== destCountry.toUpperCase();
  const serviceTypeLower = serviceType.toLowerCase();

  if (isInternational) {
    // --- International routes ---
    switch (serviceTypeLower) {
      case "express":
      case "priority":
        return 33; // Document Int'l – International Courier
      case "standard":
      case "economy":
        return 34; // Non Document Int'l – International Courier
      default:
        // GCC neighbors (road courier)
        const gccCountries = ["AE", "BH", "KW", "OM", "QA"];
        if (gccCountries.includes(destCountry.toUpperCase())) {
          return 65; // IRC – International Road Courier
        }
        return 34; // Default to Non Document Int'l
    }
  }

  // --- Domestic routes ---
  switch (serviceTypeLower) {
    case "express":
    case "priority":
      return 39; // Express Domestic
    case "standard":
    case "economy":
      return 36; // Non Document – Domestic Courier
    default:
      return 36; // Default fallback
  }
}
