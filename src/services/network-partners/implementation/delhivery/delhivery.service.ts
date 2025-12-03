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
  DropoffLocationDto,
  InvoiceDto,
  ShipmentDetailDto,
  BillingAddressDto,
} from "./delhivery.dto";
import { BaseOrderReqDtoV2 } from "src/common/dtos/base2.dto";
import { BaseOrderResDto } from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
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
      
      const timeout = this.configService.get<number>('DELHIVERY_API_TIMEOUT_MS', 30000);
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers,
          timeout: timeout,
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
        // Convert boolean to Python-style string (False/True)
        const fmPickupValue = manifestData.fm_pickup ? 'True' : 'False';
        formData.append('fm_pickup', fmPickupValue);
      }
      if (manifestData.freight_mode) {
      formData.append('freight_mode', manifestData.freight_mode);
      }
      formData.append('billing_address', JSON.stringify(manifestData.billing_address));

        const timeout = this.configService.get<number>('DELHIVERY_MANIFEST_TIMEOUT_MS', 60000);
      const response = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: {
            ...headers,
            ...formData.getHeaders(),
          },
            timeout: timeout,
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
      
      // Include transformed payload in error response for debugging
      const errorData: any = {
        ...(error.response?.data || {}),
        transformedPayload: manifestData || null,
      };
      
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create manifest: ${error.message}`,
        errorData
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

      const timeout = this.configService.get<number>('DELHIVERY_MANIFEST_TIMEOUT_MS', 60000);
      const response = await firstValueFrom(
        this.httpService.put(url, formData, {
          headers: {
            ...headers,
            ...formData.getHeaders(),
          },
          timeout: timeout,
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
      
      const timeout = this.configService.get<number>('DELHIVERY_API_TIMEOUT_MS', 30000);
      const response = await firstValueFrom(
        this.httpService.delete(url, {
          headers,
          timeout: timeout,
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

  /**
   * Create order V2 - Transform BaseOrderReqDtoV2 to Delhivery manifest format
   * @param orderDetails - Order details in V2 format
   * @param partnerCode - Partner code
   * @param eligiblePartners - Eligible partners data
   */
  async createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R> {
    let manifestData: CreateManifestDto | null = null;
    try {
      this.logger.debug(`Creating Delhivery order V2 for orderId: ${orderDetails?.orderId}`);
      
      // Transform BaseOrderReqDtoV2 to CreateManifestDto
      manifestData = this.transformToDelhiveryManifestPayload(orderDetails);
      
      // Step 1: Create manifest using existing method
      const manifestResponse = await this.createDelhiveryManifest(manifestData);
      
      // Step 2: Extract job_id from response
      const responseData = manifestResponse.data?.data || manifestResponse.data || {};
      const jobId = responseData.job_id || responseData.jobId;
      
      if (!jobId) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'No job_id received from manifest creation response',
          manifestResponse
        );
      }
      
      this.logger.debug(`Manifest created with job_id: ${jobId}, polling for completion...`);
      
      // Step 3: Poll for manifest completion - adaptive polling (fast then slow)
      const maxPollAttempts = this.configService.get<number>('DELHIVERY_MAX_POLL_ATTEMPTS', 30);
      const polledResponse = await this.pollManifestStatusAdaptive(jobId, maxPollAttempts);
      
      // Step 4: Extract lrnnum from polled response
      // Response structure: { success: true, data: { lrnum: "...", ... } }
      const polledData = polledResponse.data?.data || polledResponse.data || {};
      const lrnnum = polledData.lrnum || polledData.lrnnum || polledData.lrn || polledData.LRN || '';
      
      if (!lrnnum) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'No lrnnum received from manifest status response',
          polledResponse
        );
      }
      
      this.logger.debug(`LRN number extracted: ${lrnnum}`);
      
      // Step 5: Fetch label URLs using lrnnum
      const labelUrls = await this.getLabelUrls(lrnnum);
      
      // Step 6: Fetch label contents (base64) from each URL
      const labelContents = await this.fetchLabelContents(labelUrls);
      
      // Step 7: Transform response to BaseOrderResDto format (like Xpressbees)
      const baseUrl = this.getBaseUrl();
      const requestUrl = `${baseUrl}/manifest`;
      
      return this.transformManifestResponseToOrderResponse<R>(
        polledResponse,
        orderDetails,
        lrnnum,
        labelContents,
        manifestData,
        requestUrl
      );
    } catch (error) {
      this.logger.error(`Failed to create Delhivery order V2: ${error.message}`);
      
      // Include transformed payload in error response for debugging
      const errorData: any = {
        ...(error.response?.data || {}),
        transformedPayload: manifestData || null,
      };
      
      if (error instanceof CustomHttpException) {
        // Enhance existing CustomHttpException with transformed payload
        const existingData = error.getData || {};
        const existingTrace = error.getTrace || {};
        throw new CustomHttpException(
          error.getStatus(),
          error.message,
          {
            ...existingData,
            transformedPayload: manifestData,
          },
          {
            ...existingTrace,
            transformedPayload: manifestData,
          },
          error.getPartnerCode
        );
      }
      throw new CustomHttpException(
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create Delhivery order: ${error.message}`,
        errorData
      );
    }
  }

  /**
   * Transform BaseOrderReqDtoV2 to CreateManifestDto
   * @param order - Order in V2 format
   */
  private transformToDelhiveryManifestPayload(order: BaseOrderReqDtoV2): CreateManifestDto {
    this.logger.debug(`Transforming payload for Delhivery manifest, orderId: ${order?.orderId}`);
    
    if (!order) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'Order data is missing'
      );
    }

    if (!order.addresses || !Array.isArray(order.addresses)) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'Addresses array is missing or invalid'
      );
    }

    // Find addresses
    const pickup = order.addresses.find((a) => a.type === 'PICKUP');
    const delivery = order.addresses.find((a) => a.type === 'DELIVERY');
    const billing = order.addresses.find((a) => a.type === 'BILLING') || pickup;

    if (!pickup || !delivery) {
      throw new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        'Both PICKUP and DELIVERY addresses are required for Delhivery'
      );
    }

    // Helper functions
    const parseAmount = (value: any): number => {
      const parsed = parseFloat(String(value || 0));
      return isNaN(parsed) ? 0 : parsed;
    };

    const getEffectiveWeight = (shipment: any): number => {
      const physicalWeight = parseAmount(shipment?.physicalWeight);
      const volumetricWeight = parseAmount(shipment?.volumetricWeight);
      return physicalWeight > 0 ? physicalWeight : (volumetricWeight || 0);
    };

    // Calculate total weight (in kg)
    let totalWeight = 0;
    if (order.parentShipment) {
      totalWeight += getEffectiveWeight(order.parentShipment);
    }
    if (order.childShipments && Array.isArray(order.childShipments)) {
      order.childShipments.forEach((childShipment: any) => {
        totalWeight += getEffectiveWeight(childShipment);
      });
    }
    if (totalWeight === 0) {
      totalWeight = 10; // Default to 10 kg
    }

    // Payment mode
    const paymentMode = order.payment?.type === 'COD' ? 'cod' : 'prepaid';
    const codAmount = paymentMode === 'cod' ? parseAmount(order.payment?.finalAmount) : undefined;

    // Get pickup location name from config or metadata
    const metadataAny = order.metadata as any;
    const pickupLocationName = this.configService.get<string>(
      'DELHIVERY_PICKUP_LOCATION_NAME',
      metadataAny?.pickupLocationName || 'Main Warehouse'
    );

    // Transform dropoff location
    const dropoffLocation: DropoffLocationDto = {
      consignee_name: delivery.name || '',
      address: delivery.street || '',
      city: delivery.city || '',
      state: delivery.state || '',
      zip: delivery.zip || '',
      phone: delivery.phone || '',
      email: delivery.email || '',
    };

    // Transform invoices
    const invoices: InvoiceDto[] = [];
    if (order.documents && Array.isArray(order.documents)) {
      order.documents.forEach((doc: any) => {
        if (doc.type === 'invoice') {
          const invoiceAmount = parseAmount(doc.amount || order.payment?.breakdown?.subTotal || 0);
          const ewaybill = order.eWaybills && Array.isArray(order.eWaybills) && order.eWaybills.length > 0
            ? (typeof order.eWaybills[0] === 'string' ? order.eWaybills[0] : (order.eWaybills[0] as any)?.waybillNumber || '')
            : '';
          
          invoices.push({
            ewaybill: ewaybill,
            inv_num: doc.number || doc.invoiceNumber || '',
            inv_amt: invoiceAmount,
            inv_qr_code: doc.qrCode || '',
          });
        }
      });
    }

    // If no invoices found, create a default one
    if (invoices.length === 0) {
      const invoiceAmount = parseAmount(order.payment?.breakdown?.subTotal || order.payment?.finalAmount || 0);
      const ewaybill = order.eWaybills && Array.isArray(order.eWaybills) && order.eWaybills.length > 0
        ? (typeof order.eWaybills[0] === 'string' ? order.eWaybills[0] : (order.eWaybills[0] as any)?.waybillNumber || '')
        : '';
      
      invoices.push({
        ewaybill: ewaybill,
        inv_num: order.referenceId || order.orderId || '',
        inv_amt: invoiceAmount,
        inv_qr_code: '',
      });
    }

    // Transform shipment details
    const shipmentDetails: ShipmentDetailDto[] = [];
    
    // Add parent shipment
    if (order.parentShipment) {
      const parentWeight = getEffectiveWeight(order.parentShipment) * 1000; // Convert to grams
      shipmentDetails.push({
        order_id: order.parentShipment.awbNumber || order.awbNumber || order.orderId || '',
        box_count: 1,
        description: order.parentShipment.items?.[0]?.name || order.parentShipment.items?.[0]?.description || 'Shipment',
        weight: parentWeight,
        waybills: [], // Always empty
        master: 'False', // Always False
      });
    }

    // Add child shipments
    if (order.childShipments && Array.isArray(order.childShipments)) {
      order.childShipments.forEach((childShipment: any) => {
        const childWeight = getEffectiveWeight(childShipment) * 1000; // Convert to grams
        shipmentDetails.push({
          order_id: childShipment.awbNumber || '',
          box_count: 1,
          description: childShipment.items?.[0]?.name || childShipment.items?.[0]?.description || 'Shipment',
          weight: childWeight,
          waybills: [], // Always empty
          master: 'False', // Always False
        });
      });
    }

    // If no shipments found, create a default one
    if (shipmentDetails.length === 0) {
      shipmentDetails.push({
        order_id: order.awbNumber || order.orderId || '',
        box_count: 1,
        description: 'Shipment',
        weight: totalWeight * 1000, // Convert to grams
        waybills: [], // Always empty
        master: 'False', // Always False
      });
    }

    // Transform billing address
    const billingAny = billing as any;
    const panNumber =  billingAny?.panNumber || '';
    const billingAddress: BillingAddressDto = {
      name: billing.name || pickup.name || '',
      company: metadataAny?.companyName || billing.name || '',
      consignor: pickup.name || '',
      address: billing.street || pickup.street || '',
      city: billing.city || pickup.city || '',
      state: billing.state || pickup.state || '',
      pin: billing.zip || pickup.zip || '',
      phone: billing.phone || pickup.phone || '',
      pan_number: panNumber || 'AAAAA1111A',
      gst_number: metadataAny?.pickupGST || billingAny?.gstNumber || '',
    };

    // Freight mode - only include if provided
    const freightMode = metadataAny?.freightMode;

    // Build manifest DTO
    const manifestData: CreateManifestDto = {
      lrn: '', // Empty for auto-generation
      pickup_location_name: pickupLocationName,
      payment_mode: paymentMode,
      cod_amount: codAmount,
      weight: totalWeight,
      dropoff_location: dropoffLocation,
      rov_insurance: metadataAny?.rovInsurance || false,
      invoices: invoices,
      shipment_details: shipmentDetails,
      fm_pickup: metadataAny?.fmPickup !== undefined ? metadataAny.fmPickup : false,
      billing_address: billingAddress,
    };

    // Only add freight_mode if provided
    if (freightMode) {
      manifestData.freight_mode = freightMode;
    }

    return manifestData;
  }

  /**
   * Poll manifest status until lrnnum is received - adaptive polling
   * Fast polling (1 second) for first 5 attempts, then slower (3 seconds)
   * @param jobId - Job ID from manifest creation
   * @param maxAttempts - Maximum number of polling attempts
   */
  private async pollManifestStatusAdaptive(
    jobId: string, 
    maxAttempts: number = 30
  ): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/manifest?job_id=${jobId}`;
    
    // Fast polling for first 5 attempts (1 second), then slower (3 seconds)
    const fastPollAttempts = 5;
    const fastDelayMs = 1000; // 1 second
    const slowDelayMs = 3000; // 3 seconds
    
    this.logger.debug(`Polling manifest status for job_id: ${jobId}, adaptive polling (${fastDelayMs}ms for first ${fastPollAttempts} attempts, then ${slowDelayMs}ms)`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const headers = await this.delhiveryAuthService.getAuthHeaders();
        const timeout = this.configService.get<number>('DELHIVERY_API_TIMEOUT_MS', 30000);
        
        const response = await firstValueFrom(
          this.httpService.get(url, {
            headers,
            timeout: timeout,
          })
        );
        
        const responseData = response.data || {};
        const polledData = responseData.data || responseData;
        
        // Check specifically for lrnum (single 'n') - continue polling until it's found
        // Response structure: { success: true, data: { lrnum: "...", ... } }
        const lrnnum = polledData.lrnum || polledData.lrnnum || polledData.lrn || polledData.LRN || '';
        
        if (lrnnum) {
          this.logger.log(`LRN number received after ${attempt} polling attempts: ${lrnnum}`);
          return {
            statusCode: HttpStatus.OK,
            message: 'Manifest status retrieved successfully',
            data: responseData,
          };
        }
        
        // If lrnnum not found yet, wait and retry with adaptive delay
        if (attempt < maxAttempts) {
          const currentDelay = attempt <= fastPollAttempts ? fastDelayMs : slowDelayMs;
          const pollingMode = attempt <= fastPollAttempts ? 'fast' : 'slow';
          this.logger.debug(`LRN number not yet available, attempt ${attempt}/${maxAttempts} (${pollingMode} mode), waiting ${currentDelay}ms before next poll...`);
          await new Promise(resolve => setTimeout(resolve, currentDelay));
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new CustomHttpException(
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            `Failed to poll manifest status: ${error.message}`,
            error.response?.data
          );
        }
        // Wait before retry with adaptive delay
        const currentDelay = attempt <= fastPollAttempts ? fastDelayMs : slowDelayMs;
        this.logger.debug(`Error during polling attempt ${attempt}, retrying after ${currentDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
      }
    }
    
    throw new CustomHttpException(
      HttpStatus.REQUEST_TIMEOUT,
      `Manifest status polling timed out after ${maxAttempts} attempts. LRN number not received.`
    );
  }

  /**
   * Get label URLs using LRN number
   * Response structure: { success: true, data: [ "url1", "url2", ... ] }
   * @param lrnnum - LRN number
   * @returns Array of label URLs (as-is, no conversion)
   */
  private async getLabelUrls(lrnnum: string): Promise<string[]> {
    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/label/get_urls/std/${lrnnum}`;
      
      this.logger.debug(`Fetching label URLs for LRN: ${lrnnum} from URL: ${url}`);
      
      const headers = await this.delhiveryAuthService.getAuthHeaders();
      const timeout = this.configService.get<number>('DELHIVERY_API_TIMEOUT_MS', 30000);
      
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers,
          timeout: timeout,
        })
      );
      
      const responseData = response.data || {};
      this.logger.debug(`Label URLs API response for LRN ${lrnnum}: ${JSON.stringify(responseData)}`);
      
      // Extract label URLs array from response
      // Response structure: { success: true, data: [ "url1", "url2", ... ] }
      const labelUrls: string[] = [];
      
      if (Array.isArray(responseData.data)) {
        // If data is an array of URLs
        labelUrls.push(...responseData.data);
        this.logger.debug(`Extracted ${labelUrls.length} URLs from data array`);
      } else if (responseData.data?.label_url || responseData.data?.labelUrl) {
        // Fallback: single URL in data object
        labelUrls.push(responseData.data.label_url || responseData.data.labelUrl);
        this.logger.debug(`Extracted single URL from data object`);
      } else if (responseData.label_url || responseData.labelUrl || responseData.url) {
        // Fallback: single URL at root level
        labelUrls.push(responseData.label_url || responseData.labelUrl || responseData.url);
        this.logger.debug(`Extracted single URL from root level`);
      }
      
      if (labelUrls.length === 0) {
        this.logger.warn(`No label URLs found in response for LRN ${lrnnum}. Full response: ${JSON.stringify(responseData, null, 2)}`);
        return [];
      }
      
      this.logger.log(`Found ${labelUrls.length} label URL(s) for LRN ${lrnnum}: ${JSON.stringify(labelUrls)}`);
      return labelUrls;
    } catch (error) {
      this.logger.error(`Failed to get label URLs for LRN ${lrnnum}: ${error.message}`, error.stack);
      if (error.response) {
        this.logger.error(`Error response status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`);
      }
      // Don't throw, return empty array as fallback
      return [];
    }
  }

  /**
   * Fetch label contents (base64) from label URLs
   * Response structure: { success: true, data: "data:image/png;base64,..." } or { success: true, data: "base64string" }
   * @param labelUrls - Array of label URLs
   * @returns Array of base64-encoded label contents
   */
  private async fetchLabelContents(labelUrls: string[]): Promise<string[]> {
    if (!labelUrls || labelUrls.length === 0) {
      this.logger.warn('No label URLs provided to fetchLabelContents');
      return [];
    }

    const labelContents: string[] = [];
    const timeout = this.configService.get<number>('DELHIVERY_API_TIMEOUT_MS', 30000);

    for (let i = 0; i < labelUrls.length; i++) {
      const labelUrl = labelUrls[i];
      try {
        this.logger.debug(`Fetching label content from URL ${i + 1}/${labelUrls.length}: ${labelUrl}`);
        
        const response = await firstValueFrom(
          this.httpService.get(labelUrl, {
            timeout: timeout,
          })
        );

        const responseData = response.data || {};
        
        // Extract base64 content from responseData.data
        // Response can be: { success: true, data: "data:image/png;base64,..." } or { success: true, data: "base64string" }
        let base64Content = '';
        
        if (responseData.data) {
          const dataValue = responseData.data;
          
          // Check if it's a data URI (starts with "data:image/...;base64,")
          if (typeof dataValue === 'string' && dataValue.startsWith('data:image/')) {
            // Extract base64 part after the comma
            const base64Index = dataValue.indexOf(',');
            if (base64Index !== -1) {
              base64Content = dataValue.substring(base64Index + 1);
            } else {
              base64Content = dataValue;
            }
          } else if (typeof dataValue === 'string') {
            // Direct base64 string
            base64Content = dataValue;
          }
        }
        
        if (base64Content) {
          labelContents.push(base64Content);
          this.logger.debug(`Label ${i + 1} base64 content extracted, length: ${base64Content.length}`);
        } else {
          this.logger.warn(`No base64 content found in response for label URL ${i + 1}. Response: ${JSON.stringify(responseData)}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch label content from URL ${i + 1}: ${error.message}`);
        // Continue with other labels even if one fails
      }
    }

    this.logger.log(`Successfully fetched ${labelContents.length} label content(s) out of ${labelUrls.length} URL(s)`);
    return labelContents;
  }

  /**
   * Transform manifest response to BaseOrderResDto format (like Xpressbees)
   * @param manifestResponse - Response from polled manifest status
   * @param originalOrder - Original order request
   * @param lrnnum - LRN number
   * @param labelContents - Array of base64-encoded label contents
   * @param requestPayload - The transformed manifest payload that was sent to Delhivery
   * @param requestUrl - The URL where the manifest was created
   */
  private transformManifestResponseToOrderResponse<R extends BaseOrderResDto>(
    manifestResponse: any,
    originalOrder: BaseOrderReqDtoV2,
    lrnnum: string,
    labelContents: string[],
    requestPayload: CreateManifestDto,
    requestUrl: string
  ): R {
    // Build tracking details
    const trackingDetails = [];
    
    if (originalOrder.parentShipment) {
      trackingDetails.push({
        awbNumber: originalOrder.parentShipment.awbNumber || originalOrder.awbNumber || originalOrder.orderId || '',
        partnerAwbNumber: lrnnum,
        partnerName: PARTNER_CODE_ENUM.DELHIVERY,
        transporterId: 'DELHIVERY',
      });
    }

    if (originalOrder.childShipments && Array.isArray(originalOrder.childShipments)) {
      originalOrder.childShipments.forEach((childShipment: any) => {
        trackingDetails.push({
          awbNumber: childShipment.awbNumber || '',
          partnerAwbNumber: lrnnum, // All shipments share the same LRN
          partnerName: PARTNER_CODE_ENUM.DELHIVERY,
          transporterId: 'DELHIVERY',
        });
      });
    }

    // If no shipments, create default
    if (trackingDetails.length === 0) {
      trackingDetails.push({
        awbNumber: originalOrder.awbNumber || originalOrder.orderId || '',
        partnerAwbNumber: lrnnum,
        partnerName: PARTNER_CODE_ENUM.DELHIVERY,
        transporterId: 'DELHIVERY',
      });
    }

    // Build documents array (like Xpressbees format) - one document per label content
    const documents = [];
    this.logger.debug(`Building documents array. labelContents length: ${labelContents?.length || 0}`);
    
    if (labelContents && labelContents.length > 0) {
      labelContents.forEach((labelContent) => {
        documents.push({
          content: labelContent,
          type: 'label',
          format: 'base64',
        });
      });
      this.logger.log(`Added ${documents.length} label document(s) to response`);
    } else {
      this.logger.warn(`No label contents provided to transformManifestResponseToOrderResponse. labelContents length: ${labelContents?.length || 0}`);
    }

    // Format response like Xpressbees
    const result = {
      statusCode: HttpStatus.OK,
      message: 'Order created successfully with Delhivery',
      partnerCode: PARTNER_CODE_ENUM.DELHIVERY,
      data: {
        originalResponse: manifestResponse.data,
        requestUrl: requestUrl,
        requestBody: requestPayload,
        shipmentDetails: {
          trackingDetails: trackingDetails,
          documents: documents,
        },
      },
    } as unknown as R;

    return result;
  }
}
