import { Model } from "mongoose";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { OrderPartnerHistoryDocument } from "./order-partner-history.schema";
import { REPOSITORY_MODEL_PROVIDER_CONST } from "src/common/constants";
import { BaseMongoRepository } from "src/common/repositories/base/database.abstract";

@Injectable()
export class OrderPartnerHistoryRepository extends BaseMongoRepository<OrderPartnerHistoryDocument> {
  private readonly logger = new Logger(OrderPartnerHistoryRepository.name);

  constructor(
    @Inject(REPOSITORY_MODEL_PROVIDER_CONST.ORDER_PARTNER_HISTORY_MODEL)
    private readonly orderPartnerHistoryModel: Model<OrderPartnerHistoryDocument>
  ) {
    super(orderPartnerHistoryModel);
  }

  /**
   * Record a partner attempt history with detailed information
   * @param awbNumber The AWB number of the order
   * @param partnerCode The partner code that was attempted
   * @param partnerName The partner name
   * @param attemptNumber Which attempt number this is
   * @param isSuccessful Whether the attempt was successful
   * @param errorInfo Error information if attempt failed
   * @param requestData The request data sent to the partner
   * @param responseData The response data received from the partner
   * @returns Created history record
   */
  async recordAttempt(
    awbNumber: string,
    partnerCode: string,
    partnerName: string,
    attemptNumber: number,
    isSuccessful: boolean,
    errorInfo?: {
      errorCode?: string;
      errorMessage?: string;
      errorDetails?: Record<string, any>;
    },
    requestData?: Record<string, any>,
    responseData?: Record<string, any>,
    responseTimeMs?: number
  ): Promise<any> {
    try {
      this.logger.log(
        `Recording attempt history for AWB: ${awbNumber}, Partner: ${partnerCode}, Attempt: ${attemptNumber}`
      );

      // Add this safety check to prevent BSON serialization errors
      let safeRequestData = requestData;
      let safeResponseData = responseData;
      let safeErrorDetails = errorInfo?.errorDetails;

      try {
        // Use JSON serialization as a quick way to detect/handle circular references
        if (requestData) JSON.stringify(requestData);
        if (responseData) JSON.stringify(responseData);
        if (errorInfo?.errorDetails) JSON.stringify(errorInfo.errorDetails);
      } catch (circularError) {
        this.logger.warn(
          `Circular reference detected, sanitizing data: ${circularError.message}`
        );

        // If JSON.stringify fails, we need to sanitize the data
        try {
          if (requestData)
            safeRequestData = JSON.parse(JSON.stringify({ ...requestData }));
        } catch (e) {
          safeRequestData = {
            __sanitized: true,
            error: "Circular reference in request data",
          };
        }

        try {
          if (responseData)
            safeResponseData = JSON.parse(JSON.stringify({ ...responseData }));
        } catch (e) {
          safeResponseData = {
            __sanitized: true,
            error: "Circular reference in response data",
          };
        }

        try {
          if (errorInfo?.errorDetails) {
            safeErrorDetails = JSON.parse(
              JSON.stringify({ ...errorInfo.errorDetails })
            );
            errorInfo.errorDetails = safeErrorDetails;
          }
        } catch (e) {
          if (errorInfo)
            errorInfo.errorDetails = {
              __sanitized: true,
              error: "Circular reference in error details",
            };
        }
      }

      const historyRecord = {
        awbNumber,
        partnerCode,
        partnerName,
        attemptNumber,
        isSuccessful,
        attemptedAt: new Date(),
        requestData: safeRequestData,
        responseData: safeResponseData,
        responseTimeMs,
        ...(errorInfo && {
          errorCode: errorInfo.errorCode,
          errorMessage: errorInfo.errorMessage,
          errorDetails: errorInfo.errorDetails,
        }),
      };

      const result = await this.create(historyRecord);
      this.logger.debug(
        `Recorded attempt history for AWB: ${awbNumber}, ID: ${result._id}`
      );

      return result;
    } catch (error) {
      this.logger.error(`Error recording attempt history: ${error.message}`);
      // Don't throw the error - we don't want to fail the main operation if history recording fails
      return null;
    }
  }

  /**
   * Get all attempt history for a specific AWB number
   * @param awbNumber The AWB number to get history for
   * @returns Array of attempt history records
   */
  async getAttemptHistoryByAwb(awbNumber: string): Promise<any[]> {
    try {
      return this.getAll({ awbNumber }, null, { attemptedAt: -1 });
    } catch (error) {
      this.logger.error(`Error getting attempt history: ${error.message}`);
      return [];
    }
  }

  /**
   * Get all attempt history for a specific partner
   * @param partnerCode The partner code to get history for
   * @param limit Maximum number of records to return
   * @returns Array of attempt history records
   */
  async getAttemptHistoryByPartner(
    partnerCode: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      return this.getAll({ partnerCode }, null, { attemptedAt: -1 }, limit);
    } catch (error) {
      this.logger.error(`Error getting attempt history: ${error.message}`);
      return [];
    }
  }
}
