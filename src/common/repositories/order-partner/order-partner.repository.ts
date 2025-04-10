import { Model } from "mongoose";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { OrderPartnerDocument, Partner } from "./order-partner.schema";
import { REPOSITORY_MODEL_PROVIDER_CONST } from "src/common/constants";
import { BaseMongoRepository } from "src/common/repositories/base/database.abstract";
import { EligiblePartnersData } from "src/common/dtos/global.dto";

@Injectable()
export class OrderPartnerRepository extends BaseMongoRepository<OrderPartnerDocument> {
  private readonly logger = new Logger(OrderPartnerRepository.name);

  constructor(
    @Inject(REPOSITORY_MODEL_PROVIDER_CONST.ORDER_PARTNER_MODEL)
    private readonly orderPartnerModel: Model<OrderPartnerDocument>
  ) {
    super(orderPartnerModel);
  }

  /**
   * Create a new order partner record with eligible partners
   * @param awbNumber The AWB number of the order
   * @param eligiblePartners Data containing eligible partners
   * @returns Created order partner record
   */
  async createOrderPartnerMapping(
    awbNumber: string,
    eligiblePartners: EligiblePartnersData
  ): Promise<any> {
    this.logger.log(`Creating order partner mapping for AWB: ${awbNumber}`);
    this.logger.debug(
      `Received ${eligiblePartners.data.length} eligible partners: ${JSON.stringify(eligiblePartners.data)}`
    );

    try {
      // Check if record already exists
      const existingRecord = await this.getOne({ awbNumber });
      if (existingRecord) {
        this.logger.log(
          `Order partner mapping already exists for AWB: ${awbNumber}`
        );
        this.logger.debug(`Existing record: ${JSON.stringify(existingRecord)}`);
        return existingRecord;
      }

      const partners: Partner[] = eligiblePartners.data.map((partner) => ({
        code: partner.code,
        name: partner.name,
        partner_id: partner.id,
        attempts: 0,
        last_attempt_at: null,
        is_successful: null,
        error_code: null,
        error_message: null,
      }));

      this.logger.debug(
        `Mapped ${partners.length} partners: ${JSON.stringify(partners)}`
      );

      const orderPartnerData = {
        awbNumber,
        eligiblePartners: partners,
        retryCount: 0,
        orderCreated: false,
        isActive: true,
      };

      this.logger.debug(
        `Creating order partner with data: ${JSON.stringify(orderPartnerData)}`
      );

      const result = await this.create(orderPartnerData);
      this.logger.log(
        `Created order partner mapping for AWB: ${awbNumber}, ID: ${result._id}`
      );
      this.logger.debug(`Created record: ${JSON.stringify(result)}`);

      return result;
    } catch (error) {
      this.logger.error(
        `Error creating order partner mapping: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Get the next partner to try for an order
   * @param awbNumber The AWB number of the order
   * @param maxAttemptsPerPartner Maximum number of retry attempts per partner before moving to next partner
   * @returns Next partner code to try, or null if no eligible partners left
   */
  async getNextPartnerToTry(
    awbNumber: string,
    maxAttemptsPerPartner: number = 3
  ): Promise<string | null> {
    try {
      this.logger.log(`Finding next partner to try for AWB: ${awbNumber}`);

      const orderPartner = await this.getOne({ awbNumber });
      if (!orderPartner) {
        this.logger.warn(
          `No order partner mapping found for AWB: ${awbNumber}`
        );
        return null;
      }

      // Debug: Log the full order partner document
      this.logger.debug(
        `Order partner document: ${JSON.stringify(orderPartner)}`
      );

      // Only check orderCreated flag if all partners have been tried and marked as successful/failed
      const allPartnersHaveBeenTried = orderPartner.eligiblePartners.every(
        (partner) =>
          partner.is_successful === true || partner.is_successful === false
      );

      // Debug: Log partner statuses
      this.logger.debug(`All partners tried? ${allPartnersHaveBeenTried}`);
      orderPartner.eligiblePartners.forEach((partner) => {
        this.logger.debug(
          `Partner ${partner.code}: attempts=${partner.attempts}, is_successful=${partner.is_successful}`
        );
      });

      if (allPartnersHaveBeenTried && orderPartner.orderCreated) {
        this.logger.log(
          `Order ${awbNumber} already created successfully with one of the partners`
        );
        return null;
      }

      if (!orderPartner.isActive) {
        this.logger.log(
          `Order partner mapping for AWB: ${awbNumber} is inactive`
        );
        return null;
      }

      // Find the first partner that hasn't exceeded max attempts and:
      // 1. Either hasn't been tried yet (is_successful is null)
      // 2. Or has been tried but failed (is_successful is false)
      const nextPartner = orderPartner.eligiblePartners.find(
        (partner) =>
          partner.attempts < maxAttemptsPerPartner &&
          (partner.is_successful === null || partner.is_successful === false)
      );

      // Debug: Log information about whether a partner was found
      if (nextPartner) {
        this.logger.debug(
          `Found eligible partner: ${nextPartner.code}, attempts: ${nextPartner.attempts}, is_successful: ${nextPartner.is_successful}`
        );
      } else {
        this.logger.debug(`No eligible partners found that match the criteria`);
        orderPartner.eligiblePartners.forEach((partner) => {
          this.logger.debug(
            `Partner ${partner.code} not eligible because: ` +
              `attempts=${partner.attempts} ${partner.attempts >= maxAttemptsPerPartner ? "(too many attempts)" : "(OK)"}, ` +
              `is_successful=${partner.is_successful} ${partner.is_successful === true ? "(already successful)" : "(OK)"}`
          );
        });
      }

      if (!nextPartner) {
        this.logger.warn(
          `No more eligible partners available for AWB: ${awbNumber}`
        );
        return null;
      }

      this.logger.log(
        `Next partner to try for AWB ${awbNumber}: ${nextPartner.code}`
      );

      // Update current partner code
      await this.updateOne(
        { awbNumber },
        { $set: { currentPartnerCode: nextPartner.code } }
      );

      return nextPartner.code;
    } catch (error) {
      this.logger.error(`Error getting next partner: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update partner attempt information after trying to create an order
   * @param awbNumber The AWB number of the order
   * @param partnerCode The partner code that was attempted
   * @param isSuccessful Whether the attempt was successful
   * @param errorInfo Optional error information if attempt failed
   * @returns Updated order partner record
   */
  async updatePartnerAttempt(
    awbNumber: string,
    partnerCode: string,
    isSuccessful: boolean,
    errorInfo?: {
      errorCode?: string;
      errorMessage?: string;
    }
  ): Promise<any> {
    try {
      this.logger.log(
        `Updating partner attempt for AWB: ${awbNumber}, Partner: ${partnerCode}, Success: ${isSuccessful}`
      );

      const now = new Date();

      // Check if record exists, create if it doesn't
      const exists = await this.getOne({ awbNumber });
      if (!exists) {
        this.logger.warn(
          `No order partner mapping found for AWB: ${awbNumber}, creating simple record`
        );
        // Create a simple record with just this partner
        await this.create({
          awbNumber,
          eligiblePartners: [
            {
              code: partnerCode,
              name: partnerCode, // Using code as name since we don't have the actual name
              partner_id: 0, // Unknown ID
              attempts: 1,
              last_attempt_at: now,
              is_successful: isSuccessful,
              error_code: errorInfo?.errorCode,
              error_message: errorInfo?.errorMessage,
            },
          ],
          currentPartnerCode: partnerCode,
          retryCount: 1,
          lastRetryAt: now,
          orderCreated: isSuccessful, // This is fine for a single partner
          isActive: true,
        });

        return { awbNumber, partnerCode, updated: true, created: true };
      }

      // Build the update object
      const updateObj: any = {
        $inc: {
          retryCount: 1,
          "eligiblePartners.$.attempts": 1,
        },
        $set: {
          lastRetryAt: now,
          "eligiblePartners.$.last_attempt_at": now,
          "eligiblePartners.$.is_successful": isSuccessful,
          currentPartnerCode: partnerCode,
        },
      };

      // For orderCreated field:
      // 1. If attempt is successful, set orderCreated to true
      // 2. If attempt is unsuccessful, don't change the orderCreated status
      //    to allow other partners to be tried
      if (isSuccessful) {
        updateObj.$set.orderCreated = true;
      }

      // Add error info if available
      if (!isSuccessful && errorInfo) {
        updateObj.$set["eligiblePartners.$.error_code"] = errorInfo.errorCode;
        updateObj.$set["eligiblePartners.$.error_message"] =
          errorInfo.errorMessage;
      }

      // Update the specific partner's attempts and last attempt timestamp
      const updateResult = await this.orderPartnerModel.findOneAndUpdate(
        {
          awbNumber,
          "eligiblePartners.code": partnerCode,
        },
        updateObj,
        { new: true }
      );

      if (!updateResult && exists) {
        // Partner exists in DB but not in eligiblePartners array
        this.logger.warn(
          `Partner ${partnerCode} not found in eligiblePartners for AWB: ${awbNumber}, adding it`
        );

        // Build the new partner object
        const newPartner: any = {
          code: partnerCode,
          name: partnerCode,
          partner_id: 0,
          attempts: 1,
          last_attempt_at: now,
          is_successful: isSuccessful,
        };

        // Add error info if available
        if (!isSuccessful && errorInfo) {
          newPartner.error_code = errorInfo.errorCode;
          newPartner.error_message = errorInfo.errorMessage;
        }

        // Set update object with appropriate orderCreated status
        const setObj: {
          lastRetryAt: Date;
          currentPartnerCode: string;
          orderCreated?: boolean;
        } = {
          lastRetryAt: now,
          currentPartnerCode: partnerCode,
        };

        // For orderCreated field:
        // 1. If attempt is successful, set orderCreated to true
        // 2. If attempt is unsuccessful, don't change the orderCreated status
        //    to allow other partners to be tried
        if (isSuccessful) {
          setObj.orderCreated = true;
        }

        const result = await this.orderPartnerModel.findOneAndUpdate(
          { awbNumber },
          {
            $push: {
              eligiblePartners: newPartner,
            },
            $inc: { retryCount: 1 },
            $set: setObj,
          },
          { new: true }
        );

        return result;
      }

      return updateResult;
    } catch (error) {
      this.logger.error(`Error updating partner attempt: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark order as created successfully
   * @param awbNumber The AWB number of the order
   * @param partnerCode The partner code that successfully created the order
   * @returns Updated order partner record
   */
  async markOrderAsCreated(
    awbNumber: string,
    partnerCode: string
  ): Promise<any> {
    try {
      this.logger.log(
        `Marking order as created: AWB: ${awbNumber}, Partner: ${partnerCode}`
      );

      return this.updateOne(
        { awbNumber },
        {
          $set: {
            orderCreated: true,
            currentPartnerCode: partnerCode,
          },
        }
      );
    } catch (error) {
      this.logger.error(`Error marking order as created: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a new eligible partner to an existing order partner record
   * @param awbNumber The AWB number of the order
   * @param partnerCode The partner code to add
   * @param partnerName The partner name to add
   * @param partnerId The partner ID to add
   * @returns Updated order partner record
   */
  async addEligiblePartner(
    awbNumber: string,
    partnerCode: string,
    partnerName: string,
    partnerId: number
  ): Promise<any> {
    try {
      this.logger.log(
        `Adding eligible partner to AWB: ${awbNumber}, Partner: ${partnerCode}`
      );

      const result = await this.updateOne(
        { awbNumber },
        {
          $push: {
            eligiblePartners: {
              code: partnerCode,
              name: partnerName,
              partner_id: partnerId,
              attempts: 0,
              last_attempt_at: null,
              is_successful: null,
              error_code: null,
              error_message: null,
            },
          },
        }
      );

      this.logger.debug(
        `Added eligible partner ${partnerCode} to AWB: ${awbNumber}`
      );
      return result;
    } catch (error) {
      this.logger.error(`Error adding eligible partner: ${error.message}`);
      throw error;
    }
  }
}
