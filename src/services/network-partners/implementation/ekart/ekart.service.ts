import { Injectable, HttpStatus, Logger, Inject } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as crypto from "crypto";
import { Connection } from "mongoose";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { BaseOrderResDto, BaseResDto } from "src/common/dtos/base.dto";
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from "src/common/dtos/base2.dto";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { RepositoryConst } from "src/common";
import { 
  CargodhamOrderReqDto, 
  EkartCreateOrderReqDto, 
  EkartLoginReqDto, 
  EkartLoginResDto 
} from "./ekart.dto";

@Injectable()
export class EkartService extends BaseNetworkPartner {
  protected readonly logger = new Logger(EkartService.name);
  private cachedToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(
    protected readonly httpService: HttpService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>,
    private readonly configService: ConfigService,
    @Inject(RepositoryConst.DATABASE_NAME_CONST.DISTRIBUTOR_DB)
    private readonly connection: Connection,
  ) {
    super(
      PARTNER_CODE_ENUM.EKART,
      // Auth provider with dynamic token generation
      {
        getAuthHeaders: async () => {
          const token = await this.getAuthToken();
          return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          };
        },
      },
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  /**
   * Get authentication token (cached or generate new)
   */
  private async getAuthToken(userName?: string, password?: string): Promise<string> {
    // Return cached token if valid
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    // Generate new token
    const token = await this.generateToken(userName, password);
    return token;
  }

  /**
   * Generate authentication token via Ekart login API
   */
  async generateToken(userName?: string, password?: string): Promise<string> {
    try {
      const loginUrl = this.configService.get<string>(
        "EKART_LOGIN_URL",
        "http://103.73.191.220:8080/flipkart/api/customer/login"
      );

      // Prefer credentials from request body if provided; else fallback to env
      const username = userName || this.configService.get<string>("EKART_USERNAME", "");
      const envPassword = this.configService.get<string>("EKART_PASSWORD", "");

      if (!username || (!password && !envPassword)) {
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          "Missing credentials: provide userName/password in body or set EKART_USERNAME/EKART_PASSWORD"
        );
      }

      // If password provided in body, assume it's already encrypted per API spec; else encrypt env password
      const encryptedPassword = password
        ? password
        : this.encryptPassword(envPassword, this.getPublicKey());

      const response = await firstValueFrom(
        this.httpService.post(
          loginUrl,
          {
            userName: username,
            password: encryptedPassword,
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30000,
          }
        )
      );

      const responseData = response.data || {};

      if (!responseData.status) {
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          `EKART login failed: ${responseData.message || "Unknown error"}`
        );
      }

      const token = responseData.data;
      if (!token) {
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          "No token received from EKART login API"
        );
      }

      // Cache token (set expiry to 23 hours to be safe)
      this.cachedToken = token;
      this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

      this.logger.log("Successfully generated EKART authentication token");
      return token;
    } catch (error) {
      this.logger.error(`EKART token generation failed: ${error.message}`);
      if (error instanceof CustomHttpException) {
        throw error;
      }
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `EKART token generation failed: ${error.message}`
      );
    }
  }

  /**
   * Get RSA public key from environment variable
   */
  private getPublicKey(): string {
    const publicKey = this.configService.get<string>("EKART_PUBLIC_KEY");
    if (!publicKey) {
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "EKART_PUBLIC_KEY not configured in environment variables"
      );
    }
    return publicKey;
  }

  /**
   * Encrypt password using RSA public key
   */
  private encryptPassword(plainPassword: string, publicKey: string): string {
    try {
      const buffer = Buffer.from(plainPassword, "utf-8");
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        buffer
      );
      return encrypted.toString("base64");
    } catch (error) {
      this.logger.error(`Password encryption failed: ${error.message}`);
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to encrypt password"
      );
    }
  }

  override async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      const url = this.configService.get<string>(
        "EKART_CREATE_ORDER_URL",
        "http://103.73.191.220:8080/flipkart/api/customer/order/create"
      );

      // Extract credentials from orderDetails if available
      const userName = (orderDetails as any).userName;
      const password = (orderDetails as any).password;

      const token = await this.getAuthToken(userName, password);
      const payload = this.transformToEkartPayload(orderDetails);

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          timeout: 30000,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      const contentType = (response.headers?.["content-type"] || "").toString().toLowerCase();
      if (!contentType.includes("application/json")) {
        throw new CustomHttpException(
          HttpStatus.BAD_GATEWAY,
          "EKART returned non-JSON response. Verify EKART_* env values and URL."
        );
      }

      const responseData: any = response.data || {};

      // Check if API call was successful
      if (!responseData.status) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `EKART API error: ${responseData.message || "Unknown error"}`
        );
      }

      const data = responseData.data || {};

      // Send label to webhook
      const webhookUrl = 'https://qaapis2.delcaper.com/cargo-api/api/Webhooks/WebhookController_processPrintLabel';
      if (data.labelsLink) {
        try {
          await firstValueFrom(
            this.httpService.post(webhookUrl, { label: data.labelsLink })
          );
        } catch (error) {
          this.logger.error(`Failed to send label to webhook: ${error.message}`);
          // Decide if you want to throw an error or just log it
        }
      }

      return {
        statusCode: 200,
        message: "Order created successfully with EKART",
        partnerCode: PARTNER_CODE_ENUM.EKART,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          shipmentDetails: {
            trackingDetails: [
              {
                awbNumber: orderDetails.parentShipment?.awbNumber || orderDetails.awbNumber,
                partnerAwbNumber: String(data.docketNo || ""),
                partnerName: PARTNER_CODE_ENUM.EKART,
                transporterId: "EKART",
              },
            ],
            documents: [
              {
                content: data.labelsLink || "",
                type: "label",
                format: "PDF",
              },
            ],
          },
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`EKART createOrderV2 failed: ${error.message}`);
      if (error instanceof CustomHttpException) {
        throw error;
      }
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `EKART createOrderV2 failed: ${error.message}`
      );
    }
  }

  private transformToEkartPayload(order: BaseOrderReqDtoV2): any {
    const pickup = order.addresses?.find((a) => a.type === "PICKUP");
    const delivery = order.addresses?.find((a) => a.type === "DELIVERY");

    // Transform child shipments to lbhData
    const lbhData = (order.childShipments || []).map((shipment: any, index: number) => ({
      packetCount: 1,
      packetLength: String(shipment.dimensions?.length || 5),
      packetWidth: String(shipment.dimensions?.width || 5),
      packetHeight: String(shipment.dimensions?.height || 5),
      packetNo: null,
      customerPacketRefNo: shipment.awbNumber || `PKT-${index + 1}`,
      actualWeight: String(
        shipment.physicalWeight ||
        parseFloat(shipment.volumetricWeight || "0") ||
        parseFloat(shipment.items?.[0]?.weight || "0") ||
        1
      ),
      invoiceNo: null,
      quantity: shipment.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 1,
    }));

    // If no child shipments, create from parent
    if (lbhData.length === 0 && order.parentShipment) {
      lbhData.push({
        packetCount: 1,
        packetLength: String(order.parentShipment?.dimensions?.length || 5),
        packetWidth: String(order.parentShipment?.dimensions?.width || 5),
        packetHeight: String(order.parentShipment?.dimensions?.height || 5),
        packetNo: null,
        customerPacketRefNo: order.parentShipment?.awbNumber || order.awbNumber,
        actualWeight: String(
          order.parentShipment?.physicalWeight ||
          parseFloat(String(order.parentShipment?.volumetricWeight || "0")) ||
          parseFloat(String(order.parentShipment?.items?.[0]?.weight || "0")) ||
          1
        ),
        invoiceNo: null,
        quantity: order.parentShipment?.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 1,
      });
    }

    // Calculate total packet count and gross weight
    const packetCount = lbhData.reduce((sum, item) => sum + (item.packetCount || 0), 0);
    const grossWeight = lbhData.reduce((sum, item) => sum + (parseFloat(item.actualWeight) || 0), 0);

    // Transform documents to invoice details
    const invoiceDetails = (order.documents || [])
      .filter((doc) => doc.type?.toLowerCase().includes("invoice"))
      .map((doc) => {
        // Extract e-waybill from eWaybills array if available
        const ewaybill = order.eWaybills?.[0] || null;
        return {
          invoiceNo: doc.number || order.orderId,
          invoiceAmount: parseFloat(String(order.payment?.finalAmount || "0")),
          ewbNo: ewaybill,
          invoiceDate: order.orderDate
            ? new Date(order.orderDate).toLocaleDateString("en-GB").replace(/\//g, "-")
            : new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
          ewbDate: null,
          ewbValidTill: null,
        };
      });

    // If no invoice documents, create default
    if (invoiceDetails.length === 0) {
      invoiceDetails.push({
        invoiceNo: order.orderId,
        invoiceAmount: parseFloat(String(order.payment?.finalAmount || "0")),
        ewbNo: order.eWaybills?.[0] || null,
        invoiceDate: order.orderDate
          ? new Date(order.orderDate).toLocaleDateString("en-GB").replace(/\//g, "-")
          : new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
        ewbDate: null,
        ewbValidTill: null,
      });
    }

    // Format delivery appointment date if available
    let deliveryAppointmentDate = null;
    let deliveryTimeSlot = null;
    if (order.expectedDeliveryDate) {
      const date = new Date(order.expectedDeliveryDate);
      deliveryAppointmentDate = date.toLocaleDateString("en-GB").replace(/\//g, "-");
      deliveryTimeSlot = "16-20"; // Default time slot
    }

    return {
      poNumber: order.referenceId || "",
      travelMode: order.serviceType?.toUpperCase() === "AIR" ? "Air" : "Road",
      grossWeight: grossWeight,
      packetCount: packetCount,
      material: order.parentShipment?.items?.[0]?.description || null,
      deliveryAppointmentDate: deliveryAppointmentDate,
      deliveryTimeSlot: deliveryTimeSlot,
      deliveryType: 0, // 0 for AWD (Any working day), 1 for AD (Appointment)
      lbhData: lbhData,
      invoiceDetails: invoiceDetails,
      consignor: {
        consignorCode: this.configService.get<string>("EKART_CONSIGNOR_CODE", ""),
        consignorPincode: pickup?.zip || "",
        consignorName: pickup?.name || "",
        address1: this.sanitizeAddress(`${pickup?.street || ""} ${pickup?.landmark || ""}`.trim()),
        city: pickup?.city || "",
        state: pickup?.state || "",
        contactName: pickup?.name || "",
        contactPhoneno: pickup?.phone || "",
        email: pickup?.email || "",
      },
      consignee: {
        consigneeCode: this.configService.get<string>("EKART_CONSIGNEE_CODE", ""),
        consigneePincode: delivery?.zip || "",
        consigneeName: delivery?.name || "",
        address1: this.sanitizeAddress(`${delivery?.street || ""} ${delivery?.landmark || ""}`.trim()),
        city: delivery?.city || "",
        state: delivery?.state || "",
        contactName: delivery?.name || "",
        contactPhoneno: delivery?.phone || "",
        email: delivery?.email || "",
      },
      docketNo: null,
      packetLbhUom: "in", // inches
      totalConsignmentValue: parseFloat(String(order.payment?.finalAmount || "0")),
      ftlOrPtl: "0", // 0 for PTL (partial truck load), 1 for FTL
      openBoxPickup: 0, // 0 for normal pickup
      truckType: "20FT", // Only required if ftlOrPtl is 1
    };
  }

  /**
   * Transform Cargodham payload to Ekart format
   */
  transformCargodhamToEkart(cargodhamPayload: any): EkartCreateOrderReqDto {
    const pickup = cargodhamPayload.pickupAddress || {};
    const delivery = cargodhamPayload.shippingAddress || {};

    // Build lbhData from lineItems
    const lbhData = (cargodhamPayload.lineItems || []).map((item: any, index: number) => ({
      packetCount: item.quantity || 1,
      packetLength: String(item.length || 5),
      packetWidth: String(item.width || 5),
      packetHeight: String(item.height || 5),
      packetNo: null,
      customerPacketRefNo: `${cargodhamPayload.awbNumber}-${index + 1}`,
      actualWeight: String(item.weight || 1),
      invoiceNo: null,
      quantity: item.quantity || 1,
    }));

    // Calculate totals
    const packetCount = lbhData.reduce((sum, item) => sum + (item.packetCount || 0), 0);
    const grossWeight = lbhData.reduce((sum, item) => sum + (parseFloat(item.actualWeight) || 0), 0);

    // Build invoice details from cargoInvoices
    const invoiceDetails = (cargodhamPayload.cargoInvoices || []).map((invoice: any) => {
      const ewayBill = cargodhamPayload.ewayBills?.[0];
      return {
        invoiceNo: invoice.number || cargodhamPayload.orderId,
        invoiceAmount: cargodhamPayload.invoiceValue || 0,
        ewbNo: ewayBill?.number || null,
        invoiceDate: cargodhamPayload.orderCreatedAt
          ? new Date(cargodhamPayload.orderCreatedAt).toLocaleDateString("en-GB").replace(/\//g, "-")
          : new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
        ewbDate: null,
        ewbValidTill: ewayBill?.validUpto
          ? new Date(ewayBill.validUpto).toLocaleDateString("en-GB").replace(/\//g, "-")
          : null,
      };
    });

    // Default invoice if none provided
    if (invoiceDetails.length === 0) {
      const ewayBill = cargodhamPayload.ewayBills?.[0];
      invoiceDetails.push({
        invoiceNo: cargodhamPayload.orderId,
        invoiceAmount: cargodhamPayload.invoiceValue || 0,
        ewbNo: ewayBill?.number || null,
        invoiceDate: cargodhamPayload.orderCreatedAt
          ? new Date(cargodhamPayload.orderCreatedAt).toLocaleDateString("en-GB").replace(/\//g, "-")
          : new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
        ewbDate: null,
        ewbValidTill: ewayBill?.validUpto
          ? new Date(ewayBill.validUpto).toLocaleDateString("en-GB").replace(/\//g, "-")
          : null,
      });
    }

    // Format appointment date
    let deliveryAppointmentDate = null;
    let deliveryTimeSlot = null;
    if (cargodhamPayload.appointmentDate) {
      const date = new Date(cargodhamPayload.appointmentDate);
      deliveryAppointmentDate = date.toLocaleDateString("en-GB").replace(/\//g, "-");
      deliveryTimeSlot = "16-20";
    }

    return {
      poNumber: cargodhamPayload.orderNumber || "",
      travelMode: cargodhamPayload.deliveryMode?.toUpperCase() === "AIR" ? "Air" : "Road",
      grossWeight: grossWeight,
      packetCount: packetCount,
      material: cargodhamPayload.lineItems?.[0]?.name || null,
      deliveryAppointmentDate: deliveryAppointmentDate,
      deliveryTimeSlot: deliveryTimeSlot,
      deliveryType: cargodhamPayload.appointmentDate ? 1 : 0,
      lbhData: lbhData,
      invoiceDetails: invoiceDetails,
      consignor: {
        consignorCode: this.configService.get<string>("EKART_CONSIGNOR_CODE", ""),
        consignorPincode: pickup.zip || "",
        consignorName: pickup.name || "",
        address1: this.sanitizeAddress(`${pickup.address1 || ""} ${pickup.address2 || ""}`.trim()),
        city: pickup.city || "",
        state: pickup.state || "",
        contactName: pickup.name || "",
        contactPhoneno: pickup.phone || "",
        email: pickup.email || "",
      },
      consignee: {
        consigneeCode: this.configService.get<string>("EKART_CONSIGNEE_CODE", ""),
        consigneePincode: delivery.zip || "",
        consigneeName: delivery.name || "",
        address1: this.sanitizeAddress(`${delivery.address1 || ""} ${delivery.address2 || ""}`.trim()),
        city: delivery.city || "",
        state: delivery.state || "",
        contactName: delivery.name || "",
        contactPhoneno: delivery.phone || "",
        email: delivery.email || "",
      },
      docketNo: null,
      packetLbhUom: "in",
      totalConsignmentValue: cargodhamPayload.invoiceValue || 0,
      ftlOrPtl: cargodhamPayload.subType === "FTL" ? "1" : "0",
      openBoxPickup: 0,
      truckType: cargodhamPayload.subType === "FTL" ? "20FT" : null,
    };
  }

  /**
   * Sanitize address to remove non-ASCII characters
   */
  private sanitizeAddress(address: string): string {
    // Remove non-ASCII characters and replace with space
    return address.replace(/[^\x00-\x7F]/g, " ").replace(/\s+/g, " ").trim();
  }

  async getCancelReasons(): Promise<any> {
    try {
      const url = this.configService.get<string>(
        "EKART_CANCEL_REASONS_URL",
        "http://103.73.191.220:8080/flipkart/api/customer/cancelreasons"
      );

      const token = await this.getAuthToken();

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          timeout: 30000,
        })
      );

      const responseData = response.data || {};

      if (!responseData.status) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `EKART get cancel reasons failed: ${responseData.message || "Unknown error"}`
        );
      }

      return responseData.data || [];
    } catch (error) {
      this.logger.error(`EKART getCancelReasons failed: ${error.message}`);
      if (error instanceof CustomHttpException) {
        throw error;
      }
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `EKART getCancelReasons failed: ${error.message}`
      );
    }
  }

  override async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: any
  ): Promise<R> {
    try {
      const url = this.configService.get<string>(
        "EKART_CANCEL_ORDER_URL",
        "http://103.73.191.220:8080/flipkart/api/customer/order/cancel"
      );

      const token = await this.getAuthToken();

      const docketList = (data.cAwbNumbers || [])
        .map((awb) => parseInt(awb, 10))
        .filter((num) => !isNaN(num));

      if (docketList.length === 0) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          "No valid docket numbers provided for cancellation"
        );
      }

      const payload = {
        remarks: data.cancelReason || "",
        reason: this.configService.get<string>("EKART_DEFAULT_CANCEL_REASON", "CC"),
        docketList: docketList,
      };

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          timeout: 30000,
          validateStatus: () => true,
        })
      );

      const responseData = response.data || {};

      if (!responseData.status) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `EKART cancel order failed: ${responseData.message || "Unknown error"}`
        );
      }

      const cancelResults = responseData.data || [];
      const successCount = cancelResults.filter((r: any) => r.flag === true).length;

      return {
        statusCode: 200,
        message: `Order cancellation processed: ${successCount}/${cancelResults.length} successful`,
        partnerCode: PARTNER_CODE_ENUM.EKART,
        data: {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: payload,
          cancelResults: cancelResults,
          summary: {
            total: cancelResults.length,
            successful: successCount,
            failed: cancelResults.length - successCount,
          },
        },
      } as unknown as R;
    } catch (error) {
      this.logger.error(`EKART cancelOrderV2 failed: ${error.message}`);
      if (error instanceof CustomHttpException) {
        throw error;
      }
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `EKART cancelOrderV2 failed: ${error.message}`
      );
    }
  }

  /**
   * Update cargo user with roleType and permissions using MongoDB aggregation pipeline
   * @param userId - User ID or identifier to find the user
   * @param roleType - Role type: 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER', etc.
   * @param permissions - Array of permissions strings
   * @param queryField - Field to use for querying (default: '_id', can be 'username', 'email', etc.)
   * @returns Updated user document
   */
  async updateCargoUserRole(
    userId: string,
    roleType: string,
    permissions: string[],
    queryField: string = "_id"
  ): Promise<any> {
    try {
      this.logger.log(`Updating cargo user ${queryField}: ${userId} with roleType: ${roleType}`);

      const cargoUserCollection = this.connection.collection("cargo_user");

      // Build query filter
      const queryFilter: any = {};
      if (queryField === "_id") {
        // Convert string ID to ObjectId if needed
        const { ObjectId } = require("mongodb");
        queryFilter[queryField] = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;
      } else {
        queryFilter[queryField] = userId;
      }

      // MongoDB aggregation pipeline for update
      // Using aggregation pipeline in updateOne (MongoDB 4.2+)
      // The pipeline is an array of update stages
      const updatePipeline: any[] = [
        {
          $set: {
            roleType: roleType,
            permissions: permissions,
            updatedAt: new Date(),
          },
        },
      ];

      // Use updateOne with aggregation pipeline (MongoDB 4.2+)
      // Pass pipeline as the update parameter
      const updateResult = await cargoUserCollection.updateOne(
        queryFilter,
        updatePipeline,
        { upsert: false }
      );

      if (updateResult.matchedCount === 0) {
        throw new CustomHttpException(
          HttpStatus.NOT_FOUND,
          `Cargo user not found with ${queryField}: ${userId}`
        );
      }

      if (updateResult.modifiedCount === 0) {
        this.logger.warn(`User found but no changes were made for ${queryField}: ${userId}`);
      }

      // Fetch and return updated document
      const updatedUser = await cargoUserCollection.findOne(queryFilter);

      this.logger.log(
        `Successfully updated cargo user ${queryField}: ${userId} with roleType: ${roleType} and ${permissions.length} permissions`
      );

      return {
        statusCode: HttpStatus.OK,
        message: "Cargo user updated successfully",
        data: {
          userId,
          roleType,
          permissions,
          updatedUser,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update cargo user: ${error.message}`);
      if (error instanceof CustomHttpException) {
        throw error;
      }
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to update cargo user: ${error.message}`
      );
    }
  }
}

