import { Injectable, HttpStatus, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { BaseOrderResDto, BaseResDto } from "src/common/dtos/base.dto";
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from "src/common/dtos/base2.dto";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";

@Injectable()
export class BaralService extends BaseNetworkPartner {
  protected readonly logger = new Logger(BaralService.name);

  constructor(
    protected readonly httpService: HttpService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>,
    private readonly configService: ConfigService,
  ) {
    super(
      PARTNER_CODE_ENUM.BARAL,
      // No auth provider (static credentials in payload)
      {
        async getAuthHeaders() {
          return { "Content-Type": "application/json" };
        },
      },
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  override async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      // Normalize URL (avoid trailing slash before resource)
      let url = this.configService.get<string>("BARAL_CREATE_ORDER_URL", "https://erp.barallogistics.net/api/v1/Awbentry/Awbentry");
      if (url.endsWith("/Awbentry/")) url = url + "Awbentry";
      const payload = this.transformToBaralPayload(orderDetails);

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      const contentType = (response.headers?.["content-type"] || "").toString().toLowerCase();
      if (!contentType.includes("application/json")) {
        // BARAL likely returned an HTML login page; surface a clear error
        throw new CustomHttpException(
          HttpStatus.BAD_GATEWAY,
          "BARAL returned non-JSON (possible login page). Verify BARAL_* env values and URL."
        );
      }

      // Extract partner AWB number from various possible keys
      const d: any = response.data || {};
      const awbCandidates = [
        "AWBNo",
        "AwbNo",
        "awbNo",
        "AWBNO",
        "Awbno",
        "awbno",
        "AWB_Number",
        "Awb_Number",
        "awb_number",
        "ConsignmentNo",
        "consignmentNo",
        "LRNo",
        "lrNo",
        "LRNO",
        "lrno"
      ];
      const partnerAwb = awbCandidates.map((k) => d?.[k]).find((v) => typeof v === "string" && v.trim().length > 0) || "";

      return {
        statusCode: 200,
        message: "Order created successfully with BARAL",
        partnerCode: PARTNER_CODE_ENUM.BARAL,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          shipmentDetails: {
            trackingDetails: [
              {
                awbNumber: orderDetails.parentShipment?.awbNumber || orderDetails.awbNumber,
                partnerAwbNumber: response.data.Response.AWBNo,
                partnerName: PARTNER_CODE_ENUM.BARAL,
                transporterId: "BARAL",
              },
            ],
            documents: [
              {
                content: response.data?.pdfdownload || response.data?.Response?.pdfdownload || "",
                type: "label",
                format: "PDF",
              },
            ],
          },
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`BARAL createOrderV2 failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `BARAL createOrderV2 failed: ${error.message}`
      );
    }
  }

  private transformToBaralPayload(order: BaseOrderReqDtoV2): any {
    const pickup = order.addresses.find((a) => a.type === "PICKUP");
    const delivery = order.addresses.find((a) => a.type === "DELIVERY");

    return {
      UserID: this.configService.get<string>("BARAL_USER_ID", "100"),
      Password: this.configService.get<string>("BARAL_PASSWORD", "100@829"),
      CustomerCode: this.configService.get<string>("BARAL_CUSTOMER_CODE", "100"),
      // Strictly from env (no payload fallback)
      CustomerRefNo: this.configService.get<string>("BARAL_CUSTOMER_REF_NO", ""),
      OriginName: pickup?.city || pickup?.addressName || pickup?.state || this.configService.get<string>("BARAL_ORIGIN", "AMD"),
      // Destination should come from delivery place in payload; fallback to env/default
      DestinationName:
        delivery?.city || delivery?.addressName || delivery?.state ||
        this.configService.get<string>("BARAL_DESTINATION", "DEL"),
      ShipperName: pickup?.name || "",
      ShipperContact: "",
      ShipperAdd1: pickup?.street || "",
      ShipperAdd2: pickup?.landmark || "",
      ShipperCity: pickup?.city || "",
      ShipperState: pickup?.state || "",
      ShipperPin: pickup?.zip || "",
      ShipperTelno: pickup?.phone || "",
      ShipperMobile: pickup?.phone || "",
      ShipperEmail: pickup?.email || "",
      DocumentType: order.documentType || "GSTIN (Normal)",
      DocumentNumber: order.parentShipment?.documentType || "",
      ConsigneeName: delivery?.name || "",
      ConsigneeContact: "",
      ConsigneeAdd1: delivery?.street || "",
      ConsigneeAdd2: delivery?.landmark || "",
      ConsigneeCity: delivery?.city || "",
      ConsigneeState: delivery?.state || "",
      ConsigneePin: delivery?.zip || "",
      ConsigneeTelno: delivery?.phone || "",
      ConsigneeMobile: delivery?.phone || "",
      ConsigneeEmail: delivery?.email || "",
      Instruction: order.parentShipment?.note || "",
      VendorName: this.configService.get<string>("BARAL_VENDOR", "BRL"),
      ServiceName: this.configService.get<string>("BARAL_SERVICE", "SELF"),
      ProductCode: this.configService.get<string>("BARAL_PRODUCT", "SREV"),
      Dox_Spx: this.configService.get<string>("BARAL_DOX_SPX", "SPX"),
      Pieces: String(order.childShipments?.length || 1),
      Weight: String(order.parentShipment?.physicalWeight || 1),
      Content: order.parentShipment?.items?.[0]?.description || order.parentShipment?.items?.[0]?.name || "",
      Currency: this.configService.get<string>("BARAL_CURRENCY", "INR"),
      ShipmentValue: String(order.payment?.finalAmount || 0),
      CODAmount: "0",
      CSBType: this.configService.get<string>("BARAL_CSB_TYPE", "CSB 4"),
      TermofInvoice: "",
      // Strictly from env (no payload fallback)
      InvoiceNo: this.configService.get<string>("BARAL_INVOICE_NO", ""),
      InvoiceDate: this.configService.get<string>("BARAL_INVOICE_DATE", "15/02/2021"),
      CompanyCode: this.configService.get<string>("BARAL_COMPANY_CODE", "BRL"),
      Dimensions: (order.childShipments || []).map((c) => ({
        ActualWeight: String(c.physicalWeight || 1),
        Vol_WeightL: String(c.dimensions?.length || 10),
        Vol_WeightW: String(c.dimensions?.width || 10),
        Vol_WeightH: String(c.dimensions?.height || 10),
      })),
      Performa: (order.parentShipment?.items || []).map((it, idx) => ({
        BoxNo: `Box-${idx + 1}`,
        Description: it.description || it.name,
        HSNCode: it.hsnCode || "",
        Quantity: String(it.quantity || 1),
        Unit: "PCS",
        Weight: String(it.weight || 1),
        Rate: String(it.unitPrice || 0),
        Amount: String((it.unitPrice || 0) * (it.quantity || 1)),
      })),
    };
  }

  override async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      const url = this.configService.get<string>("BARAL_CANCEL_ORDER_URL", "https://erp.barallogistics.net/api/v1/Awbentry/CancelAWB");
      const payload = {
        UserID: this.configService.get<string>("BARAL_USER_ID", "100"),
        Password: this.configService.get<string>("BARAL_PASSWORD", "100@829"),
        AWBNo: (data.cAwbNumbers && data.cAwbNumbers[0]) || data.orderId || "",
      };

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      return {
        statusCode: 200,
        message: "Order cancelled successfully with BARAL",
        partnerCode: PARTNER_CODE_ENUM.BARAL,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`BARAL cancelOrderV2 failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `BARAL cancelOrderV2 failed: ${error.message}`
      );
    }
  }
}


