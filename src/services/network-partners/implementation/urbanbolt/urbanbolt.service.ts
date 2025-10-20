import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as https from 'https';
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { UrbanBoltAuthService } from "./urbanbolt-auth.service";
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
import { 
  URBANBOLT_ENV_KEYS,
  URBANBOLT_DEFAULTS,
  URBANBOLT_DEFAULT_VALUES,
  URBANBOLT_SERVICE_TYPES,
  URBANBOLT_PAY_MODES,
  URBANBOLT_ADDRESS_TYPES
} from "./urbanbolt-constants";
import { 
  UrbanBoltManifestRequestDto, 
  UrbanBoltManifestResponseDto,
  UrbanBoltSuccessResponseDto,
  UrbanBoltErrorResponseDto
} from "./urbanbolt.dto";

@Injectable()
export class UrbanBoltService extends BaseNetworkPartner {
  protected readonly logger = new Logger(UrbanBoltService.name);

  constructor(
    protected readonly authProvider: UrbanBoltAuthService,
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.URBANBOLT,
      authProvider,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  /**
   * Creates a manifest/booking with UrbanBolt
   * Direct implementation without using base class endpoint configuration system
   * @param orderData The order data to create manifest for
   * @param partnerCode The partner code
   * @param eligiblePartners Eligible partners data
   * @returns Promise with the manifest response
   */
  override async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderData: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    // Initialize variables outside try block for error handling
    const baseUrl = this.configService.get<string>(URBANBOLT_ENV_KEYS.BASE_URL, URBANBOLT_DEFAULTS.BASE_URL);
    const manifestPath = this.configService.get<string>(URBANBOLT_ENV_KEYS.CREATE_MANIFEST_PATH, URBANBOLT_DEFAULTS.CREATE_MANIFEST_PATH);
    const manifestUrl = `${baseUrl}${manifestPath}`;
    let urbanBoltRequest: UrbanBoltManifestRequestDto;

    try {
      this.logger.log(`Creating UrbanBolt order for: ${orderData.orderId}`);

      // Get authentication headers
      const authHeaders = await this.authProvider.getAuthHeaders();

      // Map the order data to UrbanBolt format
      urbanBoltRequest = this.mapToUrbanBoltRequest(orderData);
      
      this.logger.log(`Making UrbanBolt API call to: ${manifestUrl}`);
      this.logger.log(`UrbanBolt request payload:`, JSON.stringify(urbanBoltRequest, null, 2));

      const response = await firstValueFrom(
        this.httpService.post<UrbanBoltManifestResponseDto>(
          manifestUrl,
          [urbanBoltRequest], // UrbanBolt expects an array
          {
            headers: authHeaders,
            timeout: 30000, // 30 seconds timeout
            httpsAgent: new https.Agent({
              rejectUnauthorized: false, // Bypass SSL certificate verification for UAT environment
            }),
          }
        )
      );

      this.logger.log(`UrbanBolt API response received for order: ${orderData.orderId}`);
      this.logger.log(`UrbanBolt response body:`, JSON.stringify(response.data, null, 2));

      // Create API result object matching DHL pattern
      const apiResult = {
        response: response,
        requestUrl: manifestUrl,
        requestBody: [urbanBoltRequest]
      };

      // Map response back to standard format
      return this.formatUrbanBoltResponse<R>(apiResult, orderData);

    } catch (error) {
      this.logger.error(`UrbanBolt createOrder error: ${JSON.stringify(error)}`);
      
      // Log request and response bodies for debugging
      this.logger.error(`UrbanBolt request body:`, JSON.stringify([urbanBoltRequest], null, 2));
      if (error.response) {
        this.logger.error(`UrbanBolt API error response:`, JSON.stringify(error.response.data, null, 2));
      }

      // Return consistent error structure for exceptions (following DHL pattern)
      const errorResponse = {
        statusCode: error.status || error.response?.status || 500,
        message: `UrbanBolt createOrder failed: ${error.message || "Unknown error"}`,
        partnerCode: this.partnerCode,
        metadata: {
          transporterId: "URBANBOLT_TRANSPORTER_ID",
        },
        data: {
          originalResponse: error.response?.data || null,
          requestUrl: (error as any).requestUrl || manifestUrl || "unknown",
          requestBody: (error as any).requestBody || [urbanBoltRequest] || null,
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

      // Special handling for authentication errors - refresh token and throw
      if (error.response?.status === 401) {
        // Token might be expired, try to refresh
        await this.authProvider.refreshToken();
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          'UrbanBolt authentication failed. Please retry.',
          error
        );
      }

      // For other errors, return the consistent structure instead of throwing (following DHL pattern)
      return errorResponse as R;
    }
  }

  /**
   * Maps standard order data to UrbanBolt manifest request format
   */
  private mapToUrbanBoltRequest(orderData: BaseOrderReqDtoV2): UrbanBoltManifestRequestDto {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Extract addresses - assuming first address of each type
    const consigneeAddress = orderData.addresses?.find(addr => addr.type === 'DELIVERY') || orderData.addresses?.[0];
    const shipperAddress = orderData.addresses?.find(addr => addr.type === 'PICKUP') || orderData.addresses?.[1];
    
    // Extract payment info
    const paymentType = orderData.payment?.type || 'PPD';
    const finalAmount = orderData.payment?.finalAmount || 0;
    
    // Extract shipment details from parent shipment
    const parentShipment = orderData.parentShipment;
    const dimensions = parentShipment?.dimensions;

    return {
      customerCode: this.configService.get<string>("URBANBOLT_CUSTOMER_CODE"),
      orderNumber: orderData.orderId,
      payMode: paymentType === 'COD' ? URBANBOLT_PAY_MODES.COD : URBANBOLT_PAY_MODES.PPD,
      serviceType: URBANBOLT_SERVICE_TYPES.SDD, // Default to Same Day Delivery
      collectableValue: paymentType === 'COD' ? finalAmount : 0,
      declaredValue: finalAmount || URBANBOLT_DEFAULT_VALUES.DECLARED_VALUE,
      itemDescription: parentShipment?.note || 'General Items',
      pieces: 1, // Default to 1 piece
      weight: parseFloat(parentShipment?.physicalWeight?.toString() || URBANBOLT_DEFAULT_VALUES.WEIGHT.toString()),
      length: dimensions?.length || URBANBOLT_DEFAULT_VALUES.LENGTH,
      breadth: dimensions?.width || URBANBOLT_DEFAULT_VALUES.BREADTH,
      height: dimensions?.height || URBANBOLT_DEFAULT_VALUES.HEIGHT,
      volWeight: parseFloat(parentShipment?.volumetricWeight?.toString() || URBANBOLT_DEFAULT_VALUES.VOL_WEIGHT.toString()),
      invoiceDate: currentDate,
      invoiceNumber: orderData.referenceId || orderData.orderId,
      invoiceValue: finalAmount || URBANBOLT_DEFAULT_VALUES.DECLARED_VALUE,
      itemQuantity: 1,
      itemSku: 'DEFAULT_SKU',
      itemHsn: '000000',

      // Consignee Details
      consName: consigneeAddress?.name || 'Default Consignee',
      consAddress: consigneeAddress?.street || 'Default Address',
      consCity: consigneeAddress?.city || 'Default City',
      consState: consigneeAddress?.state || 'Default State',
      consCountry: consigneeAddress?.country || URBANBOLT_DEFAULT_VALUES.COUNTRY,
      consPincode: this.formatPincode(consigneeAddress?.zip || '000000'),
      consMobile: consigneeAddress?.phone || '0000000000',
      consEmail: consigneeAddress?.email || 'noreply@example.com',
      consLat: parseFloat(consigneeAddress?.latitude?.toString() || '0.00'),
      consLng: parseFloat(consigneeAddress?.longitude?.toString() || '0.00'),
      consAddressType: URBANBOLT_ADDRESS_TYPES.HOME,

      // Shipper Details
      shprId: orderData.metadata?.sourcePremiseId || 'DEFAULT_SELLER',
      shprName: shipperAddress?.name || 'Default Seller',
      shprAddress: shipperAddress?.street || 'Default Address',
      shprCity: shipperAddress?.city || 'Default City',
      shprState: shipperAddress?.state || 'Default State',
      shprCountry: shipperAddress?.country || URBANBOLT_DEFAULT_VALUES.COUNTRY,
      shprPincode: this.formatPincode(shipperAddress?.zip || '000000'),
      shprMobile: shipperAddress?.phone || '0000000000',
      shprEmail: shipperAddress?.email || 'seller@example.com',
      shprAddressType: URBANBOLT_ADDRESS_TYPES.WAREHOUSE,
      shprLat: parseFloat(shipperAddress?.latitude?.toString() || '0.00'),
      shprLng: parseFloat(shipperAddress?.longitude?.toString() || '0.00'),

      // Return Details (same as shipper for now)
      rtnId: orderData.metadata?.sourcePremiseId || 'DEFAULT_SELLER',
      rtnName: shipperAddress?.name || 'Default Seller',
      rtnAddress: shipperAddress?.street || 'Default Address',
      rtnCity: shipperAddress?.city || 'Default City',
      rtnState: shipperAddress?.state || 'Default State',
      rtnCountry: shipperAddress?.country || URBANBOLT_DEFAULT_VALUES.COUNTRY,
      rtnPincode: this.formatPincode(shipperAddress?.zip || '000000'),
      rtnMobile: shipperAddress?.phone || '0000000000',
      rtnEmail: shipperAddress?.email || 'seller@example.com',
    };
  }

  /**
   * Format pincode to ensure it's at least 6 characters
   */
  private formatPincode(pincode: string): string {
    // Remove any non-numeric characters
    const numericPincode = pincode.replace(/\D/g, '');
    
    // If less than 6 digits, pad with leading zeros
    if (numericPincode.length < 6) {
      return numericPincode.padStart(6, '0');
    }
    
    // If more than 6 digits, take first 6
    if (numericPincode.length > 6) {
      return numericPincode.substring(0, 6);
    }
    
    return numericPincode;
  }

  /**
   * Format UrbanBolt create order response (matching DHL pattern exactly)
   */
  private formatUrbanBoltResponse<R extends BaseOrderResDto>(apiResult: {
    response: AxiosResponse<UrbanBoltManifestResponseDto>;
    requestUrl: string;
    requestBody: any;
  }, originalOrder?: BaseOrderReqDtoV2): R {
    const { response, requestUrl, requestBody } = apiResult;
    const responseData = response.data;

    // Handle UrbanBolt's response structure: {status, successResponse[], errorResponse[]}
    if (!responseData) {
      throw new CustomHttpException(
        HttpStatus.BAD_GATEWAY,
        'Empty response from UrbanBolt API'
      );
    }

    // Check if UrbanBolt returned an errorResponse array (their specific error format)
    // Following DHL's pattern - return consistent error structure instead of throwing
    if (responseData.errorResponse && Array.isArray(responseData.errorResponse) && responseData.errorResponse.length > 0) {
      const errorDetails = responseData.errorResponse[0];
      const errorMessage = errorDetails.message || "Service not available";

      // Return consistent error structure (following DHL pattern)
      return {
        statusCode: 400,
        message: `UrbanBolt API Error: ${errorMessage}`,
        partnerCode: this.partnerCode,
        metadata: {
          transporterId: "URBANBOLT_TRANSPORTER_ID",
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

    // Handle successful response - extract from successResponse array
    const successResponse = responseData.successResponse?.[0];
    if (!successResponse && responseData.status !== "Success") {
      // Return consistent error structure (following DHL pattern)
      return {
        statusCode: 400,
        message: `UrbanBolt API Error: No successful response received`,
        partnerCode: this.partnerCode,
        metadata: {
          transporterId: "URBANBOLT_TRANSPORTER_ID",
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

    // Extract key fields from UrbanBolt response
    const primaryAwbNumber = successResponse?.trackingId || successResponse?.awbNumber || "";
    const referenceNumber = originalOrder?.orderId || "";
    const shippingLabelUrl = successResponse?.shippingLabel || "";

    // Enhanced mapping for V2 orders with multiple shipments (matching DHL)
    const shipmentDetails = this.createShipmentDetailsV2Mapping(
      successResponse,
      originalOrder
    );

    // Prepare documents array with shipping label if available
    const documents = [];
    if (shippingLabelUrl) {
      documents.push({
        type: "label",
        format: "PDF",
        content: shippingLabelUrl,
      });
    }

    return {
      statusCode: 200,
      message: "Order created successfully with UrbanBolt",
      partnerCode: this.partnerCode,
      metadata: {
        transporterId: "URBANBOLT_TRANSPORTER_ID",
      },
      data: {
        originalResponse: responseData,
        requestUrl: requestUrl,
        requestBody: requestBody,
        shipmentDetails: {
          trackingDetails: shipmentDetails,
          documents: documents
        }
      },
      trace: {
        timestamp: new Date().toISOString(),
        partnerCode: this.partnerCode,
      },
    } as R;
  }

  /**
   * Create shipment details mapping for V2 orders between our AWB numbers and UrbanBolt AWB numbers
   * Maps parent and child shipments in sequence with UrbanBolt response AWBs (matching DHL format)
   */
  private createShipmentDetailsV2Mapping(
    urbanBoltResponse: any,
    originalOrderDetails?: BaseOrderReqDtoV2
  ): any[] {
    if (!originalOrderDetails) {
      return [];
    }

    const shipmentDetails: any[] = [];

    // Gather all shipments: parent + children in sequence (same as DHL)
    const allShipments = [
      originalOrderDetails.parentShipment,
      ...(originalOrderDetails.childShipments || []),
    ].filter(Boolean);

    // Map each shipment AWB to corresponding UrbanBolt AWB in sequence (matching DHL pattern)
    allShipments.forEach((shipment, index) => {
      const urbanBoltAwb = urbanBoltResponse?.trackingId || urbanBoltResponse?.awbNumber;

      if (shipment?.awbNumber && urbanBoltAwb) {
        shipmentDetails.push({
          awbNumber: shipment.awbNumber,
          partnerAwbNumber: urbanBoltAwb,
          partnerName: "URBANBOLT",
          transporterId: "URBANBOLT_TRANSPORTER_ID",
        });
      }
    });

    return shipmentDetails;
  }


  /**
   * Get eligible partners data
   */
  async getEligiblePartnersData(): Promise<EligiblePartnersData> {
    return {
      success: true,
      message: "UrbanBolt partner data retrieved successfully",
      data: [
        {
          code: PARTNER_CODE_ENUM.URBANBOLT,
          name: 'UrbanBolt',
          parent_id: null,
          created_at: new Date().toISOString(),
          id: 1,
          partner_type_id: 1,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
      ],
      total: 1,
    };
  }
}
