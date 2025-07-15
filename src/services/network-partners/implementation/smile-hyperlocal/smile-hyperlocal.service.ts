import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { SmileHyperlocalAuthService } from "./smile-hyperlocal-auth.service";
import {
  SmileHyperlocalBookingReqDto,
  SmileHyperlocalBookingResDto,
} from "./smile-hyperlocal.dto";
import { AxiosResponse } from "axios";
import { firstValueFrom } from "rxjs";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { HttpStatus } from "@nestjs/common";
import { BaseOrderReqDto, BaseOrderResDto } from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";

@Injectable()
export class SmileHyperlocalService extends BaseNetworkPartner {
  protected readonly logger = new Logger(SmileHyperlocalService.name);

  constructor(
    private readonly authService: SmileHyperlocalAuthService,
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(
      PARTNER_CODE_ENUM.SMILE_HYPERLOCAL,
      authService,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  /**
   * Create an order with Smile Hyperlocal
   */
  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    try {
      // Transform BaseOrderReqDto to SmileHyperlocalBookingReqDto
      const bookingPayload = this.transformSmileHyperlocalCreateOrderPayload(orderDetails);
      // Get auth token
      const authHeaders = await this.authService.getAuthHeaders();
      // Get booking endpoint from config or use default
      const url = this.configService.get<string>(
        "SMILE_HYPERLOCAL_BOOKING_URL",
        "https://qaapis.delcaper.com/fulfillment/public/seller/order/push-order"
      );
      // Log request
      this.logger.log(
        `[SmileHyperlocal createOrder] Request: ${JSON.stringify(bookingPayload)}`
      );
      // Make API call
      const response = await firstValueFrom(
        this.httpService.post(url, bookingPayload, { headers: authHeaders })
      );
      this.logger.log(
        `[SmileHyperlocal createOrder] Response: ${JSON.stringify(response.data)}`
      );
      // Format and return response
      return this.formatCreateOrderResponse<R>(response);
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error;
      }
      this.logger.error(
        `[SmileHyperlocal createOrder] Error: ${error.message}`,
        error.stack
      );
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || "Smile Hyperlocal create order failed"
      );
    }
  }

  /**
   * Transform BaseOrderReqDto to SmileHyperlocalBookingReqDto
   */
  private transformSmileHyperlocalCreateOrderPayload<T extends BaseOrderReqDto>(
    orderDetails: T
  ): SmileHyperlocalBookingReqDto {
    // Map fields from BaseOrderReqDto to SmileHyperlocalBookingReqDto
    return {
      orderId: orderDetails.awbNumber,
      orderNumber: orderDetails.awbNumber,
      orderSubtype: orderDetails.shippingType || "FORWARD",
      orderCreatedAt: orderDetails.orderCreatedDate || new Date().toISOString(),
      currency: "INR",
      amount: orderDetails.paymentDetails?.amount || 0,
      weight: orderDetails.dimensions?.weight || 0,
      lineItems: [
        // This should be mapped from productDetails if available
        // Placeholder example:
        {
          name: (orderDetails as any).productDetails?.name || "Product",
          price: (orderDetails as any).productDetails?.price || 0,
          weight: orderDetails.dimensions?.weight || 0,
          quantity: (orderDetails as any).productDetails?.quantity || 1,
          sku: (orderDetails as any).productDetails?.sku || "SKU",
          unitPrice: (orderDetails as any).productDetails?.price || 0,
        },
      ],
      paymentType: orderDetails.paymentDetails?.isCOD ? "COD" : "PREPAID",
      paymentStatus: "PENDING",
      remarks: (orderDetails as any).remarks || "",
      shippingAddress: orderDetails.shippingAddress as any,
      pickupAddress: orderDetails.pickupAddress as any,
      deliveryPromise: (orderDetails as any).deliveryPromise?.shortCode || undefined,
      returnableOrder: orderDetails.returnableOrder,
      channelCode: (orderDetails as any).channelCode || undefined,
      length: orderDetails.dimensions?.length,
      height: orderDetails.dimensions?.height,
      width: orderDetails.dimensions?.breadth,
    };
  }

  /**
   * Format Smile Hyperlocal API response into standard format
   */
  private formatCreateOrderResponse<R extends BaseOrderResDto>(
    response: AxiosResponse<any>
  ): R {
    const result = new BaseOrderResDto() as R;
    // Map Smile Hyperlocal response fields to standard fields
    result.statusCode = response.data?.statusCode || 200;
    result.message = response.data?.message || "Smile Hyperlocal Create Order API success";
    result.partnerCode = this.partnerCode;
    result.data = {
      success: response.data?.success ?? true,
      orderId: response.data?.data?.orderId || response.data?.data?.orderNumber || "",
      cAwbNumber: response.data?.data?.awbNumber || "",
      status: response.data?.data?.status || "",
      message: response.data?.message || "Order created successfully",
      apiResponse: response.data,
    };
    result.trace = {
      timestamp: new Date().toISOString(),
      partnerCode: this.partnerCode,
      operation: "CREATE_ORDER",
    };
    return result;
  }

  // TODO: Implement other methods (getOrderDetails, cancelOrder, etc.) as needed
} 