import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  Query,
} from "@nestjs/common";
import { EkartService } from "./ekart.service";
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2 } from "src/common/dtos/base2.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { CargodhamOrderReqDto } from "./ekart.dto";

/**
 * Ekart controller for testing and direct API access
 */
@Controller("ekart")
export class EkartController {
  private readonly logger = new Logger(EkartController.name);

  constructor(private readonly ekartService: EkartService) {}

  /**
   * Generate authentication token
   * POST /ekart/login
   */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body?: { userName?: string; password?: string }) {
    this.logger.log("Generating Ekart authentication token");
    
    try {
      const token = await this.ekartService.generateToken(
        body?.userName,
        body?.password
      );
      
      return {
        statusCode: HttpStatus.OK,
        message: "Token generated successfully",
        data: { token },
      };
    } catch (error) {
      this.logger.error(`Token generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create order
   * POST /ekart/order/create
   * Accepts both formats:
   * 1. Direct order object: { orderId, addresses, ... }
   * 2. Nested format: { partnerCode, order: { orderId, addresses, ... } }
   */
  @Post("order/create")
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() payload: any) {
    // Handle nested payload format: { partnerCode, order: {...} }
    const orderDto: BaseOrderReqDtoV2 = payload.order || payload;
    const partnerCode = payload.partnerCode || PARTNER_CODE_ENUM.EKART;
    
    this.logger.log(`Creating order: ${orderDto.orderId}`);
    
    try {
      const result = await this.ekartService.createOrderV2(
        orderDto,
        partnerCode
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Order creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel order
   * POST /ekart/order/cancel
   */
  @Post("order/cancel")
  @HttpCode(HttpStatus.OK)
  async cancelOrder(@Body() cancelDto: BaseCancelOrderDtoV2) {
    this.logger.log(`Canceling orders: ${cancelDto.cAwbNumbers?.join(", ")}`);
    
    try {
      const result = await this.ekartService.cancelOrderV2(
        cancelDto,
        PARTNER_CODE_ENUM.EKART
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Order cancellation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cancel reasons
   * GET /ekart/cancel-reasons
   */
  @Get("cancel-reasons")
  async getCancelReasons() {
    this.logger.log("Fetching cancel reasons");
    
    try {
      const reasons = await this.ekartService.getCancelReasons();
      
      return {
        statusCode: HttpStatus.OK,
        message: "Cancel reasons fetched successfully",
        data: reasons,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch cancel reasons: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transform Cargodham payload to Ekart format
   * POST /ekart/transform/cargodham
   * This endpoint transforms the Cargodham payload without creating an order
   */
  @Post("transform/cargodham")
  @HttpCode(HttpStatus.OK)
  async transformCargodhamPayload(@Body() cargodhamPayload: CargodhamOrderReqDto) {
    this.logger.log(`Transforming Cargodham payload for order: ${cargodhamPayload.orderId}`);
    
    try {
      const ekartPayload = this.ekartService.transformCargodhamToEkart(cargodhamPayload);
      
      return {
        statusCode: HttpStatus.OK,
        message: "Payload transformed successfully",
        data: {
          ekartPayload,
          originalPayload: cargodhamPayload,
        },
      };
    } catch (error) {
      this.logger.error(`Payload transformation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create order from Cargodham payload
   * POST /ekart/order/create-from-cargodham
   * This endpoint transforms Cargodham payload and creates an Ekart order
   */
  @Post("order/create-from-cargodham")
  @HttpCode(HttpStatus.CREATED)
  async createOrderFromCargodham(@Body() cargodhamPayload: CargodhamOrderReqDto) {
    this.logger.log(`Creating Ekart order from Cargodham payload: ${cargodhamPayload.orderId}`);
    
    try {
      // Transform the payload
      const ekartPayload = this.ekartService.transformCargodhamToEkart(cargodhamPayload);
      
      // Get token
      const token = await this.ekartService["getAuthToken"]();
      const url = process.env.EKART_CREATE_ORDER_URL || "http://103.73.191.220:8080/flipkart/api/customer/order/create";
      
      // Make API call to Ekart
      const response = await this.ekartService["httpService"].post(url, ekartPayload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        timeout: 30000,
      }).toPromise();
      
      return {
        statusCode: HttpStatus.CREATED,
        message: "Order created successfully with EKART",
        data: {
          ekartResponse: response.data,
          transformedPayload: ekartPayload,
          originalPayload: cargodhamPayload,
        },
      };
    } catch (error) {
      this.logger.error(`Order creation from Cargodham failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update cargo user role and permissions
   * PATCH /ekart/users/:userId/role
   * Query params: ?queryField=_id (or username, email, etc.)
   */
  @Patch("users/:userId/role")
  @HttpCode(HttpStatus.OK)
  async updateCargoUserRole(
    @Param("userId") userId: string,
    @Body() body: { roleType: string; permissions: string[] },
    @Query("queryField") queryField?: string
  ) {
    this.logger.log(`Updating cargo user role: ${userId}`);
    
    try {
      const { roleType, permissions } = body;
      
      if (!roleType || !Array.isArray(permissions)) {
        throw new Error("roleType and permissions array are required");
      }
      
      const result = await this.ekartService.updateCargoUserRole(
        userId,
        roleType,
        permissions,
        queryField || "_id"
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to update cargo user role: ${error.message}`);
      throw error;
    }
  }
}

