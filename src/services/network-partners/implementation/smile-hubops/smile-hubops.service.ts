import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import {
  PARTNER_CODE_ENUM,
  ENDPOINT_ID_ENUM,
} from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { SmileHubopsAuthService } from "./smile-hubops-auth.service";
import { BaseOrderResDto, BaseResDto } from "src/common/dtos/base.dto";
import { BaseOrderReqDtoV2 } from "src/common/dtos/base2.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { firstValueFrom } from "rxjs";
import {
  CustomHttpException,
  TemporalErrorHandler,
} from "src/infrastructure/exception-handlers";
import { SOURCE_CONST } from "src/common/constants";
import { BaseNetworkPartnerHelper } from "../../base/base-network-partner-helper.service";
import { OrderCalculationUtils } from "src/common/utils";
import { AwbSeriesService } from "./awb-series.service";
import { ShipmentDetailsDto } from "src/common/dtos/base.dto";

/**
 * SmileHubops Service for handling V2 orders that need to be pushed to HubOps
 * This service implements createOrderV2 method that transforms V2 payload and pushes to HubOps
 */
@Injectable()
export class SmileHubopsService extends BaseNetworkPartner {
  protected readonly logger = new Logger(SmileHubopsService.name);

  constructor(
    private readonly smileHubopsAuthService: SmileHubopsAuthService,
    protected readonly httpService: HttpService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>,
    private readonly baseNetworkPartnerHelper: BaseNetworkPartnerHelper,
    private readonly awbSeriesService: AwbSeriesService
  ) {
    super(
      PARTNER_CODE_ENUM.SMILE_HUBOPS,
      smileHubopsAuthService,
      httpService,
      endpointConfigRepository,
      schemaMapper,
      baseNetworkPartnerHelper
    );
  }

  /**
   * Create Order V2 - Transforms V2 payload and pushes to HubOps
   * This is the main method for handling V2 orders for SMILE_HUBOPS partner
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    this.logger.log(
      `Creating V2 Order for SMILE_HUBOPS: ${orderDetails.orderId}`
    );

    try {
      // Get endpoint configuration for HubOps
      // TODO: Update the partner code to the latest one when endpoint configs are updated
      const endpoint = {
        url:process.env.HUB_OPS_PUSH_DATA
      }

      this.logger.log(`Sending V2 order to HubOps API: ${endpoint.url}`);

      // Transform V2 payload to HubOps format
      const hubOpsPayload = this.transformV2ToHubOpsPayload(orderDetails);
      this.logger.log("HubOps V2 payload body sent to API", hubOpsPayload);

      // Make the API call
      const response = await this.makeHubOpsApiCall(
        endpoint.url,
        hubOpsPayload,
        "HubOps V2"
      );

      // TODO: PATCHWORK FIX - Remove this and properly handle HubOps API errors
      // Currently returning success even for API failures to prevent workflow interruption
      // Original error handling should be restored once HubOps API issues are resolved

      // Check if the API response indicates failure
      const originalResponse = response.data?.originalResponse;
      if (originalResponse && originalResponse.statusCode !== 200) {
        // Log the error but don't throw - temporary patchwork solution
        this.logger.error(
          `HubOps V2 API returned error but continuing as success (PATCHWORK): ${JSON.stringify(originalResponse)}`
        );

        // Return success response with the original error data intact (NO series assignment on failure)
        return this.createSuccessResponse<R>(
          response.data, // Keep original response structure with error details
          "V2 Order processed for HubOps (with API errors - patchwork fix)"
        );
      }

      // SUCCESS - Now assign AWB numbers from series if enabled
      const trackingDetails: ShipmentDetailsDto[] = [];

      if (orderDetails.assignAWBFromSeries === true) {
        this.logger.log(
          `HubOps API successful - Now assigning AWB from series for order: ${orderDetails.orderId}`
        );

        // Assign AWB for parent shipment
        const parentPartnerAwb = await this.awbSeriesService.getNextAwbNumber(
          PARTNER_CODE_ENUM.SMILE_HUBOPS,
          orderDetails.orderId,
          "parent",
          orderDetails.parentShipment?.awbNumber || orderDetails.awbNumber
        );

        trackingDetails.push({
          awbNumber:
            orderDetails.parentShipment?.awbNumber || orderDetails.awbNumber,
          partnerAwbNumber: parentPartnerAwb,
          partnerName: PARTNER_CODE_ENUM.SMILE_HUBOPS,
          transporterId: "",
        });

        this.logger.log(
          `Assigned parent AWB: ${parentPartnerAwb} for ${orderDetails.parentShipment?.awbNumber}`
        );

        // Assign AWB for child shipments if any
        if (
          orderDetails.childShipments &&
          orderDetails.childShipments.length > 0
        ) {
          for (const childShipment of orderDetails.childShipments) {
            const childPartnerAwb =
              await this.awbSeriesService.getNextAwbNumber(
                PARTNER_CODE_ENUM.SMILE_HUBOPS,
                orderDetails.orderId,
                "child",
                childShipment.awbNumber
              );

            trackingDetails.push({
              awbNumber: childShipment.awbNumber,
              partnerAwbNumber: childPartnerAwb,
              partnerName: PARTNER_CODE_ENUM.SMILE_HUBOPS,
              transporterId: "",
            });

            this.logger.log(
              `Assigned child AWB: ${childPartnerAwb} for ${childShipment.awbNumber}`
            );
          }
        }
      }

      // Add tracking details to successful response
      const responseData = {
        ...response.data,
        ...(trackingDetails.length > 0 && {
          shipmentDetails: { trackingDetails },
        }),
      };

      return this.createSuccessResponse<R>(
        responseData,
        "V2 Order successfully pushed to HubOps"
      );
    } catch (error) {
      this.logger.error(
        `Failed to create V2 order for SMILE_HUBOPS: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Get endpoint configuration
   */
  private async getEndpoint(partnerCode: string, endpointId: string) {
    const endpoint = await this.endpointConfigRepository.getOne({
      partnerCode,
      endpointId,
    });

    if (!endpoint) {
      const customError = new CustomHttpException(
        HttpStatus.NOT_FOUND,
        `Endpoint configuration not found for ${partnerCode} - ${endpointId}`
      );

      // Convert to ApplicationFailure for Temporal compatibility
      TemporalErrorHandler.throwAsApplicationFailure(customError);
    }

    return endpoint;
  }

  /**
   * Map parcel category to valid HubOps booking type
   * HubOps doesn't accept "INTERNATIONAL" as a booking type, so we map it to "COURIER"
   */
  private mapBookingType(parcelCategory: string | undefined): string {
    if (!parcelCategory) {
      return "COURIER"; // Default fallback
    }

    const upperCategory = parcelCategory.toUpperCase();
    
    // HubOps valid booking types: COURIER, CARGO, ECOMM, etc.
    // Map "INTERNATIONAL" to "COURIER" as international orders are typically courier shipments
    if (upperCategory === "INTERNATIONAL") {
      return "COURIER";
    }

    // Return the category as-is if it's already a valid type
    return upperCategory;
  }

  /**
   * Transform V2 payload to HubOps format
   * Converts the new V2 order structure to the format expected by HubOps API
   */
  private transformV2ToHubOpsPayload(orderV2: BaseOrderReqDtoV2): any[] {
    // Extract addresses
    const pickupAddress = orderV2.addresses?.find(
      (addr) => addr.type === "PICKUP"
    );
    const deliveryAddress = orderV2.addresses?.find(
      (addr) => addr.type === "DELIVERY"
    );

    // Extract e-waybill numbers from eWaybills array and join as comma-separated string
    const ewayBillNumbers = orderV2.eWaybills?.join(",") || "";

    // Determine document type based on parcel category and document type
    const docType =
      orderV2.parcelCategory?.toUpperCase() === "COURIER" &&
      orderV2?.parentShipment?.documentType?.toLowerCase() === "docs"
        ? "dox"
        : "non-dox";

    // Get parent shipment AWB
    const awbNumber = orderV2.parentShipment?.awbNumber;

    // Map booking type to valid HubOps format
    const bookingType = this.mapBookingType(orderV2.parcelCategory);

    // Create the booking payload and wrap it in an array (HubOps expects array format)
    return [
      {
        awbNumber: awbNumber,
        bookingStatus: orderV2.orderStatus,
        bookingType: bookingType,
        ewayBillNumber: ewayBillNumbers,
        docType: docType,
        extendEwayBillCount: 0,
        fromPincode: parseInt(pickupAddress?.zip),
        height: orderV2.parentShipment?.dimensions?.height,
        length: orderV2.parentShipment?.dimensions?.length,
        modeOfPayment: orderV2.payment?.type === "COD" ? "COD" : "PREPAID",
        receiverAddressLine1: deliveryAddress?.street || "",
        receiverCity: deliveryAddress?.city || "",
        receiverMobileNumber: parseInt(deliveryAddress?.phone || "0"),
        receiverName: deliveryAddress?.name || "",
        receiverPincode: parseInt(deliveryAddress?.zip),
        receiverState: deliveryAddress?.state || "",
        senderAddressLine: pickupAddress?.street || "",
        senderCity: pickupAddress?.city || "",
        senderName: pickupAddress?.name || "",
        senderPincode: parseInt(pickupAddress?.zip),
        senderState: pickupAddress?.state || "",
        service: orderV2.serviceType || "",
        source: SOURCE_CONST.ORCHESTRATOR,
        childAwbs:
          orderV2.childShipments?.map((child) => child.awbNumber) || [],
        mcn: orderV2?.mcn || false,
        // partnerCode: orderV2.partner?.code || "",
        time: "",
        toPincode: parseInt(deliveryAddress?.zip || "0"),
        travelBy: orderV2.deliveryMode || "",
        value: OrderCalculationUtils.calculateTotalShipmentValue(orderV2),
        description: orderV2.parentShipment?.note || "",
        sourcePremiseId: orderV2.metadata?.sourcePremiseId || "",
        volumetricWeight:
          OrderCalculationUtils.getVolumetricWeightWithDefault(orderV2),
        weight: OrderCalculationUtils.calculateMaxWeight(orderV2),
        width: orderV2.parentShipment?.dimensions?.width || 0,
      },
    ];
  }

  /**
   * Make API call to HubOps with proper error handling
   */
  private async makeHubOpsApiCall<T>(
    url: string,
    body: T,
    operation: string = "HubOps V2"
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            "Content-Type": "application/json",
          },
        })
      );

      // Include request body in success response
      if (response.data) {
        response.data = {
          originalResponse: response.data,
          requestUrl: url,
          requestBody: body,
        };
      }

      return response;
    } catch (error) {
      this.logger.error(
        `Error making ${operation} API call: ${error.message}`,
        error.stack
      );

      // Extract detailed error information
      const errorResponse = error.response || {};
      const errorData = errorResponse.data || {};
      const statusCode =
        errorResponse.status || HttpStatus.INTERNAL_SERVER_ERROR;

      // Construct meaningful error message for the data payload
      let detailedErrorMessage = `${operation} API request failed`;
      if (typeof errorData === "string") {
        detailedErrorMessage = errorData;
      } else if (
        errorData.message ||
        errorData.error ||
        errorData.description
      ) {
        detailedErrorMessage =
          errorData.message || errorData.error || errorData.description;
      } else if (
        errorData.errors &&
        Array.isArray(errorData.errors) &&
        errorData.errors.length > 0
      ) {
        detailedErrorMessage = errorData.errors
          .map((e) => e.message || e)
          .join(", ");
      }

      // Log detailed error info
      this.logger.error(
        `${operation} API call failed with status ${statusCode}: ${detailedErrorMessage}`
      );
      this.logger.error(`Request URL: ${url}`);
      this.logger.error(`Request body: ${JSON.stringify(body)}`);
      this.logger.error(`Response data: ${JSON.stringify(errorData)}`);

      // Format the root message as [operation] API fail
      const rootMessage = `${operation} API fail`;

      const customError = new CustomHttpException(statusCode, rootMessage, {
        originalResponse: errorData,
        requestUrl: url,
        requestBody: body,
      });

      // Convert to ApplicationFailure for Temporal compatibility
      TemporalErrorHandler.throwAsApplicationFailure(customError);
    }
  }
}
