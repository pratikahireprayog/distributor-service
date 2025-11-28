import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { DelhiveryAuthService } from "./delhivery-auth.service";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import {
  CreateManifestDto,
  UpdateLrnDto,
  CancelLrnDto,
  DelhiveryPincodeQueryDto,
} from "./delhivery.dto";
import * as FormData from "form-data";

/**
 * Delhivery service for LTL (Less Than Truckload) operations
 */
@Injectable()
export class DelhiveryService extends BaseNetworkPartner {
  protected readonly logger = new Logger(DelhiveryService.name);

  constructor(
    protected readonly httpService: HttpService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>,
    private readonly configService: ConfigService,
    private readonly delhiveryAuthService: DelhiveryAuthService
  ) {
    super(
      PARTNER_CODE_ENUM.DELHIVERY,
      delhiveryAuthService,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  /**
   * Get base URL for Delhivery API
   */
  private getBaseUrl(): string {
    return this.configService.get<string>(
      "DELHIVERY_BASE_URL",
      "https://ltl-clients-api-dev.delhivery.com"
    );
  }

  /**
   * Get pincode serviceability information
   * @param pincode - The pincode to check
   * @param weight - Optional weight parameter
   */
  async getPincodeService(
    pincode: string,
    weight?: number
  ): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/pincode-service/${pincode}${weight ? `?weight=${weight}` : ''}`;
      
      this.logger.debug(`Fetching pincode service for: ${pincode}`);
      
      const headers = await this.delhiveryAuthService.getAuthHeaders();
      
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers,
          timeout: 30000,
        })
      );

      this.logger.log(`Pincode service fetched successfully for: ${pincode}`);
      return {
        statusCode: HttpStatus.OK,
        message: "Pincode service retrieved successfully",
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch pincode service: ${error.message}`);
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to fetch pincode service: ${error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Create a new manifest
   * @param manifestData - Manifest creation data
   */
  async createDelhiveryManifest(manifestData: CreateManifestDto): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/manifest`;
      
      this.logger.debug(`Creating manifest for: ${manifestData.pickup_location_name}`);
      
      const headers = await this.delhiveryAuthService.getAuthHeaders();
      
      // Create form data
      const formData = new FormData();
      
      // Add all fields to form data
      if (manifestData.lrn) formData.append('lrn', manifestData.lrn);
      formData.append('pickup_location_name', manifestData.pickup_location_name);
      formData.append('payment_mode', manifestData.payment_mode);
      if (manifestData.cod_amount !== undefined) {
        formData.append('cod_amount', manifestData.cod_amount.toString());
      }
      formData.append('weight', manifestData.weight.toString());
      formData.append('dropoff_location', JSON.stringify(manifestData.dropoff_location));
      if (manifestData.rov_insurance !== undefined) {
        formData.append('rov_insurance', manifestData.rov_insurance.toString());
      }
      formData.append('invoices', JSON.stringify(manifestData.invoices));
      formData.append('shipment_details', JSON.stringify(manifestData.shipment_details));
      if (manifestData.doc_data) {
        formData.append('doc_data', JSON.stringify(manifestData.doc_data));
      }
      if (manifestData.doc_file) {
        formData.append('doc_file', manifestData.doc_file);
      }
      if (manifestData.fm_pickup !== undefined) {
        formData.append('fm_pickup', manifestData.fm_pickup.toString());
      }
      formData.append('freight_mode', manifestData.freight_mode);
      formData.append('billing_address', JSON.stringify(manifestData.billing_address));

      const response = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: {
            ...headers,
            ...formData.getHeaders(),
          },
          timeout: 60000,
        })
      );

      this.logger.log(`Manifest created successfully`);
      return {
        statusCode: HttpStatus.CREATED,
        message: "Manifest created successfully",
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to create manifest: ${error.message}`);
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create manifest: ${error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Update an existing LRN
   * @param updateData - LRN update data
   */
  async updateDelhiveryLrn(updateData: UpdateLrnDto): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/lrn/update/${updateData.lrn}`;
      
      this.logger.debug(`Updating LRN: ${updateData.lrn}`);
      
      const headers = await this.delhiveryAuthService.getAuthHeaders();
      
      // Create form data
      const formData = new FormData();
      
      // Add optional fields
      if (updateData.invoices) {
        formData.append('invoices', JSON.stringify(updateData.invoices));
      }
      if (updateData.cod_amount !== undefined) {
        formData.append('cod_amount', updateData.cod_amount.toString());
      }
      if (updateData.consignee_name) {
        formData.append('consignee_name', updateData.consignee_name);
      }
      if (updateData.consignee_address) {
        formData.append('consignee_address', updateData.consignee_address);
      }
      if (updateData.consignee_pincode) {
        formData.append('consignee_pincode', updateData.consignee_pincode);
      }
      if (updateData.consignee_phone) {
        formData.append('consignee_phone', updateData.consignee_phone);
      }
      if (updateData.weight_g !== undefined) {
        formData.append('weight_g', updateData.weight_g.toString());
      }
      if (updateData.cb) {
        formData.append('cb', JSON.stringify(updateData.cb));
      }
      if (updateData.dimensions) {
        formData.append('dimensions', JSON.stringify(updateData.dimensions));
      }
      if (updateData.invoice_files_meta) {
        formData.append('invoice_files_meta', JSON.stringify(updateData.invoice_files_meta));
      }
      if (updateData.invoice_file) {
        formData.append('invoice_file', updateData.invoice_file);
      }

      const response = await firstValueFrom(
        this.httpService.put(url, formData, {
          headers: {
            ...headers,
            ...formData.getHeaders(),
          },
          timeout: 60000,
        })
      );

      this.logger.log(`LRN updated successfully: ${updateData.lrn}`);
      return {
        statusCode: HttpStatus.OK,
        message: "LRN updated successfully",
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to update LRN: ${error.message}`);
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to update LRN: ${error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Cancel an existing LRN
   * @param lrn - LRN to cancel
   */
  async cancelDelhiveryLrn(lrn: string): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/lrn/cancel/${lrn}`;
      
      this.logger.debug(`Canceling LRN: ${lrn}`);
      
      const headers = await this.delhiveryAuthService.getAuthHeaders();
      
      const response = await firstValueFrom(
        this.httpService.delete(url, {
          headers,
          timeout: 30000,
        })
      );

      this.logger.log(`LRN cancelled successfully: ${lrn}`);
      return {
        statusCode: HttpStatus.OK,
        message: "LRN cancelled successfully",
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to cancel LRN: ${error.message}`);
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to cancel LRN: ${error.message}`,
        error.response?.data
      );
    }
  }
}
