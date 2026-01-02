import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AxiosResponse } from "axios";

import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { GatiAuthService } from "./gati-auth.service";
import { BaseOrderReqDtoV2 } from "src/common/dtos/base2.dto";
import {
  BaseOrderResDto,
} from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { CustomHttpException } from "src/infrastructure/exception-handlers";

interface Dimensions {
    width?: number;
    height?: number;
    length?: number;
  }
  
  interface ShipmentLike {
    dimensions?: Dimensions;
    physicalWeight?: number | string;
    volumetricWeight?: number | string;
    weight?: number | string;
    description?: string;
  }
  
  interface AddressLike {
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    landmark?: string;
    zip?: string;
    phone?: string;
    email?: string;
  }
  
@Injectable()
export class GatiService extends BaseNetworkPartner {
  protected readonly logger = new Logger(GatiService.name);

  // Hardcoded customer code as per requirements
  private readonly CUST_CODE = "30790101";

  constructor(
    private readonly authService: GatiAuthService,
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.GATI,
      authService,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  /**
   * Create an order with Gati using V2 payload
   * First gets docket number, then creates the order
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      this.logger.debug(`Gati createOrderV2 called with orderDetails: ${JSON.stringify(orderDetails)}`);

      if (!orderDetails) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Order details are required'
        );
      }

      // Step 1: Get docket number
      const docketNo = await this.getDocketNumber();

      // Step 2: Get package numbers for all boxes
      const deliveryAddress =
        orderDetails.addresses?.find((a: any) => a.type === "DELIVERY") ||
        ({} as any);
      const pincode = deliveryAddress.zip || "";
      const noOfPackages = 1 + (orderDetails.childShipments?.length || 0);
      const packageNumbers = await this.getPackageNumbers(
        docketNo,
        noOfPackages,
        pincode
      );

      // Step 3: Transform the payload for Gati API
      const transformedData = this.transformToGatiPayload(
        orderDetails,
        docketNo,
        packageNumbers
      );

      // Step 4: Get authentication headers
      const authHeaders = await this.authService.getAuthHeaders();

      // Step 5: Get create order endpoint URL
      const baseUrl = this.configService.get<string>(
        "GATI_BASE_URL",
        "https://pg-uat.gati.com"
      );
      const createOrderPath = this.configService.get<string>(
        "GATI_CREATE_ORDER_PATH",
        "/pickupservices/GATIKWEJPICKUPLBH.jsp"
      );
      const url = `${baseUrl}${createOrderPath}`;

      this.logger.log(`Creating order with Gati: ${url}`);
      this.logger.debug(`Request payload: ${JSON.stringify(transformedData, null, 2)}`);

      // Step 6: Make API call to create order
      const response = await firstValueFrom(
        this.httpService.post(url, transformedData, {
          headers: authHeaders,
          timeout: 30000,
          validateStatus: () => true,
          maxContentLength: Infinity as unknown as number,
          maxBodyLength: Infinity as unknown as number,
        })
      );

      // Check response status
      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`Gati API returned status ${response.status}`, response.data);
        
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Gati API returned error: ${response.data?.message || JSON.stringify(response.data)}`
        );
      }

      // Format and return response
      return this.formatCreateOrderResponse<R>(
        response,
        url,
        transformedData,
        orderDetails,
        docketNo
      );
      
    } catch (error) {
      // If this is a CustomHttpException, throw it with HTTP error
      if (error instanceof CustomHttpException) {
        throw error;
      }

      // For other errors, wrap them in CustomHttpException
      this.logger.error(
        `[Gati createOrderV2] Error for OrderId: ${orderDetails.orderId || ""} - ${error.message}`,
        error.stack
      );

      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create order with Gati: ${error.message}`
      );
    }
  }

  /**
   * Get docket number from Gati API
   */
  private async getDocketNumber(): Promise<string> {
    try {
      const baseUrl = this.configService.get<string>(
        "GATI_BASE_URL",
        "https://pg-uat.gati.com"
      );
      const docketPath = this.configService.get<string>(
        "GATI_DOCKET_PATH",
        "/pickupservices/GKEdktdownloadjson.jsp"
      );
      const docketParam = this.configService.get<string>(
        "GATI_DOCKET_PARAM",
        "3D5C34DD01057110B9B7F75BF69DE49C"
      );
      const url = `${baseUrl}${docketPath}?p1=${docketParam}`;

      const authHeaders = await this.authService.getAuthHeaders();

      this.logger.debug(`Getting docket number from: ${url}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: authHeaders,
          timeout: 30000,
          validateStatus: () => true,
        })
      );

      if (response.status !== 200) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Failed to get docket number: ${response.data?.message || JSON.stringify(response.data)}`
        );
      }

      const docketNo = response.data?.docketNo;
      if (!docketNo) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Docket number not found in response: ${JSON.stringify(response.data)}`
        );
      }

      this.logger.log(`Retrieved docket number: ${docketNo}`);
      return String(docketNo);
    } catch (error) {
      this.logger.error(`Error getting docket number: ${error.message}`, error.stack);
      if (error instanceof CustomHttpException) {
        throw error;
      }
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to get docket number: ${error.message}`
      );
    }
  }

  /**
   * Get package numbers from Gati API
   */
  private async getPackageNumbers(
    docketNo: string,
    numberOfBoxes: number,
    pincode: string
  ): Promise<number[]> {
    try {
      const baseUrl = this.configService.get<string>(
        "GATI_BASE_URL",
        "https://pg-uat.gati.com"
      );
      const packageSeriesPath = this.configService.get<string>(
        "GATI_PACKAGE_SERIES_PATH",
        "/pickupservices/Custpkgseries.jsp"
      );
      const hardcodedParam = this.configService.get<string>(
        "GATI_PACKAGE_SERIES_PARAM",
        "3D5C34DD01057110B9B7F75BF69DE49C"
      );
      const url = `${baseUrl}${packageSeriesPath}?p1=${docketNo}&p2=${numberOfBoxes}&p3=${hardcodedParam}&p4=${pincode}`;

      const authHeaders = await this.authService.getAuthHeaders();

      this.logger.debug(`Getting package numbers from: ${url}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: authHeaders,
          timeout: 30000,
          validateStatus: () => true,
        })
      );

      if (response.status !== 200) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Failed to get package numbers: ${response.data?.message || JSON.stringify(response.data)}`
        );
      }

      const responseData = response.data;
      
      if (responseData?.result !== "successful") {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Package series API returned error: ${responseData?.sErrMsg || JSON.stringify(responseData)}`
        );
      }

      const frmNo = parseInt(responseData?.frmNo, 10);
      const toNo = parseInt(responseData?.toNo, 10);

      if (isNaN(frmNo) || isNaN(toNo)) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          `Invalid package number range in response: ${JSON.stringify(responseData)}`
        );
      }

      // Generate array of package numbers from frmNo to toNo
      const packageNumbers: number[] = [];
      for (let i = frmNo; i <= toNo; i++) {
        packageNumbers.push(i);
      }

      this.logger.log(
        `Retrieved package numbers: ${frmNo} to ${toNo} (${packageNumbers.length} packages)`
      );

      if (packageNumbers.length !== numberOfBoxes) {
        this.logger.warn(
          `Package number count (${packageNumbers.length}) doesn't match number of boxes (${numberOfBoxes})`
        );
      }

      return packageNumbers;
    } catch (error) {
      this.logger.error(`Error getting package numbers: ${error.message}`, error.stack);
      if (error instanceof CustomHttpException) {
        throw error;
      }
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to get package numbers: ${error.message}`
      );
    }
  }

  /**
   * Transform V2 order request into Gati API format
   */
 
private transformToGatiPayload<T extends BaseOrderReqDtoV2>(
    orderDetails: T,
    docketNo: string,
    packageNumbers: number[]
  ): any {
  
    // ---------------- Addresses ----------------
    const deliveryAddress: AddressLike =
      orderDetails.addresses?.find(a => a.type === "DELIVERY") ?? {};
  
    // ---------------- Shipments ----------------
    const parentShipment: ShipmentLike =
      orderDetails.parentShipment ?? {};
  
    const childShipments: ShipmentLike[] =
      orderDetails.childShipments ?? [];
  
    const allShipments: ShipmentLike[] = [
      parentShipment,
      ...childShipments,
    ];
  
    // ---------------- Resolve per-box weight ----------------
    const resolvePkgWeight = (shipment: ShipmentLike): number => {
      const physical = Number(shipment.physicalWeight);
      const volumetric = Number(shipment.volumetricWeight);
      const fallback = Number(parentShipment.weight);
  
      if (physical > 0) return physical;
      if (volumetric > 0) return volumetric;
      if (fallback > 0) return fallback;
      return 2; // absolute safety fallback
    };
  
    // ---------------- Build package info ----------------
    let totalShipmentWeight = 0;
  
    const pkginfo = allShipments.map((shipment, index) => {
      const dimensions: Dimensions =
        shipment.dimensions ??
        parentShipment.dimensions ??
        {};
  
      const pkgWt = resolvePkgWeight(shipment);
      totalShipmentWeight += pkgWt;
  
      return {
        pkgNo: packageNumbers[index],
        pkgBr: dimensions.width ?? 2,     // ✅ width → pkgBr
        pkgHt: dimensions.height ?? 2,
        pkgLn: dimensions.length ?? 2,
        pkgWt,                             // ✅ resolved weight
        custPkgNo: "",
      };
    });
  
    const fromPkgNo = packageNumbers[0];
    const toPkgNo = packageNumbers[packageNumbers.length - 1];
  
    // ---------------- Declared cargo value ----------------
    const declaredCargoVal =
      Number(
        orderDetails.payment?.breakdown?.subTotal ??
        orderDetails.payment?.finalAmount ??
        0
      );
  
    // ---------------- Pickup request date ----------------
    const now = new Date();
    const pickupRequestDate =
      `${String(now.getDate()).padStart(2, "0")}-` +
      `${String(now.getMonth() + 1).padStart(2, "0")}-` +
      `${now.getFullYear()} ` +
      `${String(now.getHours()).padStart(2, "0")}:` +
      `${String(now.getMinutes()).padStart(2, "0")}:` +
      `${String(now.getSeconds()).padStart(2, "0")}`;
  
    // ---------------- Final payload ----------------
    const transformedData = {
      custCode: this.CUST_CODE,
      pickupRequest: pickupRequestDate,
      details: [
        {
          docketNo,
          orderNo:
            orderDetails.orderId ??
            orderDetails.referenceId ??
            "TEST_ORDER",
  
          // ✅ TOTAL WEIGHT = SUM OF ALL BOXES
          actualWt: totalShipmentWeight,
          chargedWt: totalShipmentWeight,
  
          bookingBasis: "2",
          prodServCode: "1",
          goodsCode: "206",
          goodsDesc: parentShipment.description ?? "Test",
          declCargoVal: declaredCargoVal,
          // Packages
          noOfPkgs: String(pkginfo.length),
          fromPkgNo,
          toPkgNo,
          pkgDetails: { pkginfo },
  
          // Shipper
          shipperCode: this.CUST_CODE,
          custVendCode: "BLRS001",
  
          // Receiver
          receiverCode: "99999",
          receiverName: deliveryAddress.name ?? "",
          receiverAdd1: deliveryAddress.street ?? "",
          receiverAdd2: deliveryAddress.city ?? "",
          receiverAdd3: deliveryAddress.state ?? "",
          receiverAdd4: deliveryAddress.landmark ?? "",
          receiverCity: deliveryAddress.city ?? "",
          receiverPinCode: deliveryAddress.zip ?? "",
          receiverMobileNo: deliveryAddress.phone ?? "",
          receiverPhoneNo: deliveryAddress.phone ?? "",
          receiverEmail: deliveryAddress.email ?? "xyz@raymond.in",
  
          // Misc
          codAmt: "0",
          codInFavourOf: "G",
          consignorGSTINNo: "",
          ReceiverGSTINNo: "",
          CustDeliveyDate: "",
          deliveryStn: "",
          instructions: "",
          locationCode: "",
          EWAYBILL: "",
          EWB_EXP_DT: "",
          UOM: "I",
        },
      ],
    };
  
    this.logger.log(
      `[Gati createOrderV2] Transformed payload: ${JSON.stringify(transformedData)}`
    );
  
    return transformedData;
  }
  
  
  /**
   * Format Gati API response into standard format
   */
  private formatCreateOrderResponse<R extends BaseOrderResDto>(
    response: AxiosResponse<any>,
    requestUrl: string,
    requestBody: any,
    orderDetails: BaseOrderReqDtoV2,
    docketNo: string
  ): R {
    const baseUrl =
      this.configService.get<string>("GATI_BASE_URL") ||
      "https://pg-uat.gati.com";
  
    const custCode = this.CUST_CODE;
  
    /** -----------------------------
     * 1️⃣ Build tracking details
     * Parent + child shipments
     * ----------------------------- */
    const trackingDetails: any[] = [];
  
    // Parent shipment
    if (orderDetails.parentShipment?.awbNumber) {
      trackingDetails.push({
        awbNumber: orderDetails.parentShipment.awbNumber,
        partnerAwbNumber: docketNo,
        partnerName: this.partnerCode,
        transporterId: "GATI",
      });
    }
  
    // Child shipments
    (orderDetails.childShipments || []).forEach((child: any) => {
      if (child?.awbNumber) {
        trackingDetails.push({
          awbNumber: child.awbNumber,
          partnerAwbNumber: docketNo,
          partnerName: this.partnerCode,
          transporterId: "GATI",
        });
      }
    });
  
    /** -----------------------------
     * 2️⃣ Build document URLs
     * ----------------------------- */
    const documents = [
      {
        type: "label",
        format: "url",
        content: `${baseUrl}/GATICOM_CUSTPKG.jsp?p1=3&p=${docketNo}&p3=3`,
      },
      {
        type: "docket",
        format: "url",
        content: `${baseUrl}/InterfaceA4Print.jsp?p1=${docketNo}&p2=${custCode}`,
      },
    ];
  
    /** -----------------------------
     * 3️⃣ Return standardized response
     * ----------------------------- */
    return {
      statusCode: 200,
      message: "Order created successfully with Gati",
      partnerCode: this.partnerCode,
      metadata: {},
      data: {
        originalResponse: response.data,
        requestUrl,
        requestBody,
        shipmentDetails: {
          trackingDetails,
          documents,
        },
      },
      trace: {
        timestamp: new Date().toISOString(),
        partnerCode: this.partnerCode,
      },
    } as unknown as R;
  }
  
}

