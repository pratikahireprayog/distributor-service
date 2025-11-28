import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { DelhiveryService } from "./delhivery.service";
import { DelhiveryAuthService } from "./delhivery-auth.service";
import {
  CreateManifestDto,
  UpdateLrnDto,
  CancelLrnDto,
  DelhiveryLoginDto,
} from "./delhivery.dto";

/**
 * Delhivery controller for LTL operations
 */
@Controller("delhivery")
export class DelhiveryController {
  private readonly logger = new Logger(DelhiveryController.name);

  constructor(
    private readonly delhiveryService: DelhiveryService,
    private readonly delhiveryAuthService: DelhiveryAuthService
  ) {}

  /**
   * Login to Delhivery and get authentication token
   * POST /delhivery/login
   */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: DelhiveryLoginDto) {
    this.logger.log(`Login request for user: ${loginDto.username}`);
    
    try {
      const token = await this.delhiveryAuthService.generateToken();
      
      return {
        statusCode: HttpStatus.OK,
        message: "Login successful",
        data: { token },
      };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pincode serviceability
   * GET /delhivery/pincode-service/:pincode
   */
  @Get("pincode-service/:pincode")
  async getPincodeService(
    @Param("pincode") pincode: string,
    @Query("weight") weight?: number
  ) {
    this.logger.log(`Fetching pincode service for: ${pincode}`);
    
    return await this.delhiveryService.getPincodeService(pincode, weight);
  }

  /**
   * Create a new manifest
   * POST /delhivery/manifest
   */
  @Post("manifest")
  @HttpCode(HttpStatus.CREATED)
  async createManifest(@Body() manifestDto: CreateManifestDto) {
    this.logger.log(`Creating manifest for: ${manifestDto.pickup_location_name}`);
    
    return await this.delhiveryService.createDelhiveryManifest(manifestDto);
  }

  /**
   * Update an existing LRN
   * PUT /delhivery/lrn/update/:lrn
   */
  @Put("lrn/update/:lrn")
  @HttpCode(HttpStatus.OK)
  async updateLrn(
    @Param("lrn") lrn: string,
    @Body() updateDto: Omit<UpdateLrnDto, "lrn">
  ) {
    this.logger.log(`Updating LRN: ${lrn}`);
    
    // Combine path parameter with body
    const fullUpdateDto: UpdateLrnDto = {
      ...updateDto,
      lrn,
    };
    
    return await this.delhiveryService.updateDelhiveryLrn(fullUpdateDto);
  }

  /**
   * Cancel an existing LRN
   * DELETE /delhivery/lrn/cancel/:lrn
   */
  @Delete("lrn/cancel/:lrn")
  @HttpCode(HttpStatus.OK)
  async cancelLrn(@Param("lrn") lrn: string) {
    this.logger.log(`Canceling LRN: ${lrn}`);
    
    return await this.delhiveryService.cancelDelhiveryLrn(lrn);
  }
}

