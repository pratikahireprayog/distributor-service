import { Injectable, Logger } from "@nestjs/common";
import {
  BaseCancelOrderDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
} from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { OrderPartnerHistoryRepository } from "src/common/repositories/order-partner/order-partner-history.repository";
import { OrderPartnerRepository } from "src/common/repositories/order-partner/order-partner.repository";

/**
 * Helper class for network partner operations
 * Contains common functionality shared across partner implementations
 */
@Injectable()
export class BaseNetworkPartnerHelper {
  protected readonly logger = new Logger(this.constructor.name);
  // Define internal partner codes
  protected readonly INTERNAL_PARTNERS = ["SMILE_HUBOPS", "DEFAULT"];

  constructor(
    protected readonly orderPartnerRepository: OrderPartnerRepository,
    protected readonly orderPartnerHistoryRepository: OrderPartnerHistoryRepository
  ) {}

  /**
   * Record a successful order attempt
   */
  public async recordSuccessfulAttempt<T extends BaseOrderReqDto, R>(
    awbNumber: string,
    partnerCode: string,
    existingPartners: any,
    eligiblePartners: EligiblePartnersData | undefined,
    attemptNumber: number,
    result: R,
    responseTimeMs: number,
    orderData: T
  ): Promise<void> {
    const partnerName = this.getPartnerName(partnerCode, eligiblePartners);

    // Update order_partner record only for external partners
    if (!this.isInternalPartner(partnerCode)) {
      await this.updateOrderPartnerRecord(
        awbNumber,
        partnerCode,
        true,
        existingPartners
      );
    } else {
      this.logger.debug(
        `Skipping order_partner update for internal partner ${partnerCode}`
      );
    }

    // Record detailed history for ALL partners (internal and external)
    try {
      // Sanitize the data to prevent BSON circular reference errors
      const sanitizedOrderData = this.sanitizeDataForMongoDB(orderData);
      const sanitizedResult = this.sanitizeDataForMongoDB(result);

      await this.orderPartnerHistoryRepository.recordAttempt(
        awbNumber,
        partnerCode,
        partnerName,
        attemptNumber,
        true,
        undefined,
        this.sanitizeDataForLogging(sanitizedOrderData),
        this.sanitizeDataForLogging(sanitizedResult),
        responseTimeMs
      );
    } catch (historyError) {
      this.logger.error(`Failed to record history: ${historyError.message}`);
    }
  }

  /**
   * Record a failed order attempt
   */
  public async recordFailedAttempt<T extends BaseOrderReqDto>(
    error: any,
    orderData: T,
    partnerCode: string,
    existingPartners: any,
    eligiblePartners: EligiblePartnersData | undefined,
    attemptNumber: number
  ): Promise<void> {
    const partnerName = this.getPartnerName(partnerCode, eligiblePartners);
    const errorCode = error.code || error.status || "UNKNOWN";
    const errorMessage = error.message || "Unknown error";
    const errorInfo = {
      errorCode,
      errorMessage,
      errorDetails: error.response?.data || error.details || {},
    };

    this.logger.error(
      `Partner ${partnerCode} attempt #${attemptNumber} failed for AWB ${
        orderData.awbNumber
      }: ${errorCode} - ${errorMessage} ${
        error.responseTimeMs ? `(${error.responseTimeMs}ms)` : ""
      }`
    );

    // Update order_partner record only for external partners
    if (!this.isInternalPartner(partnerCode)) {
      await this.updateOrderPartnerRecord(
        orderData.awbNumber,
        partnerCode,
        false,
        existingPartners,
        errorInfo
      );
    } else {
      this.logger.debug(
        `Skipping order_partner update for internal partner ${partnerCode}`
      );
    }

    // Record detailed history for ALL partners (internal and external)
    try {
      // Sanitize the data to prevent BSON circular reference errors
      const sanitizedOrderData = this.sanitizeDataForMongoDB(orderData);
      const sanitizedErrorDetails = this.sanitizeDataForMongoDB(
        errorInfo.errorDetails
      );
      errorInfo.errorDetails = sanitizedErrorDetails;

      await this.orderPartnerHistoryRepository.recordAttempt(
        orderData.awbNumber,
        partnerCode,
        partnerName,
        attemptNumber,
        false,
        errorInfo,
        this.sanitizeDataForLogging(sanitizedOrderData),
        null, // No response data for failed attempt
        error.responseTimeMs
      );
    } catch (historyError) {
      this.logger.error(`Failed to record history: ${historyError.message}`);
    }
  }

  /**
   * Loads or stores partner information for an order
   */
  public async loadOrStorePartners(
    awbNumber: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<any> {
    // Check if this order already has partners stored
    let existingPartners;
    if (!eligiblePartners) {
      existingPartners = await this.orderPartnerRepository.getOne({
        awbNumber,
      });

      this.logger.debug(
        `Existing partners for ${awbNumber}: ${existingPartners ? "Found" : "None"}`
      );

      return existingPartners;
    }

    this.logger.debug(
      `Eligible partners from API: ${JSON.stringify(eligiblePartners)}`
    );

    if (eligiblePartners?.data) {
      this.logger.debug(
        `Validating ${eligiblePartners.data.length} eligible partners: ${eligiblePartners.data.map((p) => p.code).join(", ")}`
      );
    }

    // Get existing partners record
    existingPartners = await this.orderPartnerRepository.getOne({
      awbNumber,
    });

    // If no existing record but we have eligible partners, store them
    if (
      !existingPartners &&
      eligiblePartners?.success &&
      eligiblePartners?.data?.length > 0
    ) {
      existingPartners = await this.storeEligiblePartners(
        awbNumber,
        eligiblePartners
      );
    }
    // If we have both existing record and eligible partners, update if needed
    else if (
      existingPartners &&
      eligiblePartners?.success &&
      eligiblePartners?.data?.length > 0
    ) {
      existingPartners = await this.updateMissingPartners(
        awbNumber,
        existingPartners,
        eligiblePartners
      );
    }

    return existingPartners;
  }

  /**
   * Update the order partner record
   */
  protected async updateOrderPartnerRecord(
    awbNumber: string,
    partnerCode: string,
    isSuccessful: boolean,
    existingPartners?: any,
    errorInfo?: {
      errorCode: string;
      errorMessage: string;
    }
  ): Promise<void> {
    try {
      if (existingPartners) {
        // Update existing record
        const updateResult =
          await this.orderPartnerRepository.updatePartnerAttempt(
            awbNumber,
            partnerCode,
            isSuccessful,
            errorInfo
          );

        this.logger.debug(
          `Updated partner attempt record for ${partnerCode}: success=${isSuccessful}`
        );
      } else {
        // Create new record
        const createResult =
          await this.orderPartnerRepository.updatePartnerAttempt(
            awbNumber,
            partnerCode,
            isSuccessful,
            errorInfo
          );

        this.logger.debug(
          `Created partner attempt record for ${partnerCode}: success=${isSuccessful}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${existingPartners ? "update" : "create"} partner attempt record: ${error.message}`
      );
    }
  }

  /**
   * Store eligible partners in the database
   */
  protected async storeEligiblePartners(
    awbNumber: string,
    eligiblePartners: EligiblePartnersData
  ): Promise<any> {
    this.logger.debug(
      `Storing eligible partners for ${awbNumber}: ${eligiblePartners.data.length} partners available`
    );

    try {
      const result =
        await this.orderPartnerRepository.createOrderPartnerMapping(
          awbNumber,
          eligiblePartners
        );

      this.logger.debug(
        `Successfully stored ${eligiblePartners.data.length} eligible partners for order ${awbNumber}`
      );

      return result;
    } catch (error) {
      this.logger.error(`Error storing eligible partners: ${error.message}`);
      return null;
    }
  }

  /**
   * Update existing partners record with any missing partners
   */
  protected async updateMissingPartners(
    awbNumber: string,
    existingPartners: any,
    eligiblePartners: EligiblePartnersData
  ): Promise<any> {
    // Check if all eligible partners from API are present in the DB record
    const dbPartnerCodes = existingPartners.eligiblePartners.map((p) => p.code);

    const apiPartnerCodes = eligiblePartners.data.map((p) => p.code);

    // Find missing partners (in API but not in DB)
    const missingPartners = eligiblePartners.data.filter(
      (apiPartner) => !dbPartnerCodes.includes(apiPartner.code)
    );

    if (missingPartners.length === 0) {
      return existingPartners;
    }

    this.logger.warn(
      `Found ${missingPartners.length} partners from API not in DB record: ${missingPartners.map((p) => p.code).join(", ")}`
    );

    // Add each missing partner to the DB
    for (const apiPartner of missingPartners) {
      try {
        await this.orderPartnerRepository.addEligiblePartner(
          awbNumber,
          apiPartner.code,
          apiPartner.name,
          apiPartner.id
        );

        this.logger.debug(
          `Added missing partner ${apiPartner.code} to DB record for ${awbNumber}`
        );
      } catch (error) {
        this.logger.error(
          `Failed to add missing partner ${apiPartner.code}: ${error.message}`
        );
      }
    }

    // Refresh the existingPartners record to include newly added partners
    return await this.orderPartnerRepository.getOne({
      awbNumber,
    });
  }

  /**
   * Get the current attempt number for a partner
   */
  public getAttemptNumber(existingPartners: any, partnerCode: string): number {
    if (!existingPartners) {
      return 1;
    }

    const partnerInfo = existingPartners.eligiblePartners.find(
      (p) => p.code === partnerCode
    );

    if (partnerInfo) {
      return partnerInfo.attempts + 1;
    }

    return 1;
  }

  /**
   * Get partner name from eligible partners data or use code as fallback
   */
  protected getPartnerName(
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): string {
    // For internal partners, we can just return the code as the name
    if (this.isInternalPartner(partnerCode)) {
      return partnerCode;
    }

    // For external partners, try to get the name from eligible partners data
    if (eligiblePartners?.success && eligiblePartners?.data) {
      const partner = eligiblePartners.data.find((p) => p.code === partnerCode);
      if (partner) {
        return partner.name;
      }
    }

    // Default fallback to using the code as the name
    return partnerCode;
  }

  /**
   * Sanitize sensitive data for logging
   */
  protected sanitizeDataForLogging(data: any): Record<string, any> {
    if (!data) return undefined;

    // Create a deep copy to avoid modifying the original
    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove sensitive fields if present
    if (sanitized.pickupAddress?.mobile) {
      sanitized.pickupAddress.mobile = this.maskPhoneNumber(
        sanitized.pickupAddress.mobile
      );
    }

    if (sanitized.shippingAddress?.mobile) {
      sanitized.shippingAddress.mobile = this.maskPhoneNumber(
        sanitized.shippingAddress.mobile
      );
    }

    return sanitized;
  }

  /**
   * Mask phone number for privacy
   */
  protected maskPhoneNumber(phone: string): string {
    if (!phone) return phone;
    if (phone.length <= 4) return phone;

    return `****${phone.substring(phone.length - 4)}`;
  }

  /**
   * Check if a partner is an internal partner
   */
  protected isInternalPartner(partnerCode: string): boolean {
    return this.INTERNAL_PARTNERS.includes(partnerCode);
  }

  /**
   * Determine which partner to use based on eligibility
   */
  public async determinePartnerWithEligibility(
    orderData: BaseOrderReqDto,
    eligiblePartners?: EligiblePartnersData
  ): Promise<PARTNER_CODE_ENUM> {
    // If partner code exists in order data, use it
    const partnerCode = orderData?.partnerCode;
    if (partnerCode) {
      this.logger.debug(`Using partner code from order data: ${partnerCode}`);
      return partnerCode as PARTNER_CODE_ENUM;
    }

    // If eligible partners data is provided and has at least one partner
    if (
      eligiblePartners?.success &&
      eligiblePartners?.data &&
      eligiblePartners.data.length > 0
    ) {
      // Check if there's an existing record to determine if we should use a different partner
      const existingRecord = await this.orderPartnerRepository.getOne({
        awbNumber: orderData.awbNumber,
      });

      this.logger.debug(
        `Existing record for partner selection: ${JSON.stringify(existingRecord)}`
      );

      let selectedPartnerCode: string;

      if (existingRecord && existingRecord.eligiblePartners.length > 0) {
        // Group partners by status for better decision making
        const untriedPartners = existingRecord.eligiblePartners.filter(
          (p) => p.is_successful === null || p.attempts === 0
        );

        const failedPartners = existingRecord.eligiblePartners.filter(
          (p) => p.is_successful === false && p.attempts < 3 // 3 is default max attempts
        );

        const successfulPartners = existingRecord.eligiblePartners.filter(
          (p) => p.is_successful === true
        );

        this.logger.debug(
          `Partner groups for selection: ${untriedPartners.length} untried, ${failedPartners.length} failed with attempts < 3, ${successfulPartners.length} successful`
        );

        // Selection logic with clear priority
        if (untriedPartners.length > 0) {
          // Prefer untried partners first
          selectedPartnerCode = untriedPartners[0].code;
          this.logger.debug(`Selected untried partner: ${selectedPartnerCode}`);
        } else if (failedPartners.length > 0) {
          // Then try partners that failed but haven't reached max attempts
          // Sort by fewest attempts
          const sortedFailedPartners = [...failedPartners].sort(
            (a, b) => a.attempts - b.attempts
          );
          selectedPartnerCode = sortedFailedPartners[0].code;
          this.logger.debug(
            `Selected failed partner with fewest attempts: ${selectedPartnerCode} (${sortedFailedPartners[0].attempts} attempts so far)`
          );
        } else if (successfulPartners.length > 0) {
          // If all others are exhausted but we have a successful partner, use it
          selectedPartnerCode = successfulPartners[0].code;
          this.logger.debug(
            `All partners tried, reusing successful partner: ${selectedPartnerCode}`
          );
        } else {
          // Fallback to first eligible partner from API
          selectedPartnerCode = eligiblePartners.data[0].code;
          this.logger.debug(
            `No suitable partners in records, using first eligible partner from API: ${selectedPartnerCode}`
          );
        }
      } else {
        // No existing record, use the first eligible partner from API
        selectedPartnerCode = eligiblePartners.data[0].code;
        this.logger.debug(
          `Using first eligible partner from API: ${selectedPartnerCode} of ${eligiblePartners.data.length} available partners`
        );
      }

      // Add the partner code to the order data for future use
      orderData.partnerCode = selectedPartnerCode as PARTNER_CODE_ENUM;
      return selectedPartnerCode as PARTNER_CODE_ENUM;
    }

    // If no partner code is found and no eligible partners are provided
    this.logger.debug(
      "No partner code found and no eligible partners provided, using default partner"
    );
    return PARTNER_CODE_ENUM.DEFAULT;
  }

  /**
   * Safely convert data to a format that can be stored in MongoDB
   * Prevents circular reference errors when saving to BSON
   */
  protected sanitizeDataForMongoDB(data: any): Record<string, any> {
    if (!data) return null;

    try {
      // First convert to JSON and back to remove circular references and functions
      const safeData = JSON.parse(JSON.stringify(data));
      return safeData;
    } catch (error) {
      this.logger.warn(`Failed to sanitize data for MongoDB: ${error.message}`);
      // Return a safe object with error info if conversion fails
      return {
        __sanitized: true,
        __error:
          "Object contained circular references or could not be serialized",
        __sanitized_at: new Date().toISOString(),
      };
    }
  }
}
