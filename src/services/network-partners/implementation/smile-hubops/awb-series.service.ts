import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { AwbSeriesRepository } from "src/common/repositories/awb-series/awb-series.repository";
import { AwbSeriesAuditRepository } from "src/common/repositories/awb-series-audit/awb-series-audit.repository";
import { DiscordAlertService } from "src/infrastructure/alert/discord-alert.service";
import {
  CustomHttpException,
  TemporalErrorHandler,
} from "src/infrastructure/exception-handlers";

export interface AwbAssignment {
  awbNumber: string;
  partnerAwbNumber: string;
  partnerName: string;
}

@Injectable()
export class AwbSeriesService {
  private readonly logger = new Logger(AwbSeriesService.name);
  private readonly NOTIFICATION_THRESHOLDS = [
    20, 40, 60, 80, 90, 95, 98, 99, 100,
  ];

  constructor(
    private readonly awbSeriesRepository: AwbSeriesRepository,
    private readonly awbSeriesAuditRepository: AwbSeriesAuditRepository,
    private readonly discordAlertService: DiscordAlertService
  ) {}

  /**
   * Get next AWB number from series with atomic increment
   * Handles consumption tracking and notifications
   */
  async getNextAwbNumber(
    partnerCode: string,
    orderId: string,
    awbType: "parent" | "child",
    awbNumber: string
  ): Promise<string> {
    this.logger.log(
      `Getting next AWB number for ${partnerCode}, order: ${orderId}, type: ${awbType}`
    );

    // Single atomic operation: get and increment (only if series is active and not exhausted)
    const updatedSeries =
      await this.awbSeriesRepository.incrementCounter(partnerCode);

    if (!updatedSeries) {
      // Increment failed - could be: no series, inactive, or exhausted
      // Fetch to determine exact reason for better error messaging
      const existingSeries =
        await this.awbSeriesRepository.getActiveSeriesForPartner(partnerCode);

      if (!existingSeries) {
        // No active series found
        const errorMessage = `No active AWB series found for partner: ${partnerCode}`;
        this.logger.error(errorMessage);

        // Send Discord alert for monitoring
        await this.discordAlertService.sendAwbSeriesAlert({
          partnerCode,
          orderId,
          alertType: "NO_ACTIVE_SERIES",
          message: errorMessage,
          severity: "error",
        });

        // Throw error - cannot continue without active series
        const customError = new CustomHttpException(
          HttpStatus.NOT_FOUND,
          errorMessage
        );
        TemporalErrorHandler.throwAsApplicationFailure(customError);
      } else if (existingSeries.currentCounter > existingSeries.seriesEnd) {
        // Series exhausted
        const errorMessage = `AWB series exhausted for partner: ${partnerCode}. Current: ${existingSeries.currentCounter}, End: ${existingSeries.seriesEnd}`;
        this.logger.error(errorMessage);

        // Send Discord alert for monitoring
        await this.discordAlertService.sendAwbSeriesAlert({
          partnerCode,
          orderId,
          alertType: "SERIES_EXHAUSTED",
          message: errorMessage,
          currentCounter: existingSeries.currentCounter,
          seriesEnd: existingSeries.seriesEnd,
          severity: "critical",
        });

        // Throw error - cannot continue with exhausted series
        const customError = new CustomHttpException(
          HttpStatus.CONFLICT,
          errorMessage,
          {
            currentCounter: existingSeries.currentCounter,
            seriesEnd: existingSeries.seriesEnd,
          }
        );
        TemporalErrorHandler.throwAsApplicationFailure(customError);
      } else {
        // Increment failed for unknown reason
        const errorMessage = `Failed to increment AWB series counter for partner: ${partnerCode}`;
        this.logger.error(errorMessage);

        // Send Discord alert for monitoring
        await this.discordAlertService.sendAwbSeriesAlert({
          partnerCode,
          orderId,
          alertType: "INCREMENT_FAILED",
          message: errorMessage,
          severity: "error",
        });

        // Throw error - increment operation failed
        const customError = new CustomHttpException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage
        );
        TemporalErrorHandler.throwAsApplicationFailure(customError);
      }
    }

    // Success - series was incremented atomically
    const assignedAwbNumber = updatedSeries.currentCounter.toString();

    // Log assignment to audit
    try {
      await this.awbSeriesAuditRepository.logAwbAssignment(
        updatedSeries._id.toString(),
        partnerCode,
        assignedAwbNumber,
        orderId,
        awbType
      );
    } catch (auditError) {
      this.logger.error(
        `Failed to log AWB assignment to audit: ${auditError.message}`,
        auditError.stack
      );
      // Don't fail the main operation if audit logging fails
    }

    // Calculate consumption percentage and check for notifications
    const consumptionPercentage = this.calculateConsumptionPercentage(
      updatedSeries.currentCounter,
      updatedSeries.seriesStart,
      updatedSeries.seriesEnd
    );

    this.logger.log(
      `AWB series consumption: ${consumptionPercentage.toFixed(2)}% for ${partnerCode}`
    );

    // Check and send notifications for thresholds
    await this.checkAndSendNotifications(
      updatedSeries,
      consumptionPercentage,
      orderId
    );

    this.logger.log(
      `Assigned AWB number: ${assignedAwbNumber} for order: ${orderId}, type: ${awbType}`
    );

    return assignedAwbNumber;
  }

  /**
   * Calculate consumption percentage
   */
  private calculateConsumptionPercentage(
    currentCounter: number,
    seriesStart: number,
    seriesEnd: number
  ): number {
    const totalRange = seriesEnd - seriesStart + 1;
    const consumed = currentCounter - seriesStart + 1;
    return (consumed / totalRange) * 100;
  }

  /**
   * Check consumption thresholds and send Discord notifications
   */
  private async checkAndSendNotifications(
    series: any,
    consumptionPercentage: number,
    orderId: string
  ): Promise<void> {
    // Check each threshold
    for (const threshold of this.NOTIFICATION_THRESHOLDS) {
      // If consumption has reached or exceeded threshold and notification not yet sent
      if (
        consumptionPercentage >= threshold &&
        !series.notificationThresholds.includes(threshold)
      ) {
        this.logger.warn(
          `AWB series ${threshold}% threshold reached for ${series.partnerCode}`
        );

        // Send Discord notification
        await this.discordAlertService.sendAwbSeriesAlert({
          partnerCode: series.partnerCode,
          orderId,
          alertType: "THRESHOLD_REACHED",
          threshold,
          consumptionPercentage: parseFloat(consumptionPercentage.toFixed(2)),
          currentCounter: series.currentCounter,
          seriesStart: series.seriesStart,
          seriesEnd: series.seriesEnd,
          remaining: series.seriesEnd - series.currentCounter,
          severity:
            threshold >= 95 ? "critical" : threshold >= 80 ? "warning" : "info",
          message: `AWB series for ${series.partnerCode} has reached ${threshold}% consumption`,
        });

        // Mark threshold as notified
        await this.awbSeriesRepository.addNotificationThreshold(
          series.partnerCode,
          threshold
        );
      }
    }
  }

  /**
   * Get active series for a partner
   */
  async getActiveSeriesForPartner(partnerCode: string) {
    return this.awbSeriesRepository.getActiveSeriesForPartner(partnerCode);
  }

  /**
   * Create a new series (for admin API)
   */
  async createSeries(
    partnerCode: string,
    seriesStart: number,
    seriesEnd: number
  ) {
    this.logger.log(
      `Creating new AWB series for ${partnerCode}: ${seriesStart} - ${seriesEnd}`
    );

    // Validate that seriesEnd > seriesStart
    if (seriesEnd <= seriesStart) {
      const customError = new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        "Series end must be greater than series start"
      );
      TemporalErrorHandler.throwAsApplicationFailure(customError);
    }

    try {
      return await this.awbSeriesRepository.createSeries(
        partnerCode,
        seriesStart,
        seriesEnd
      );
    } catch (error) {
      // If series already exists, throw appropriate error
      if (error.message.includes("already exists")) {
        const customError = new CustomHttpException(
          HttpStatus.CONFLICT,
          error.message
        );
        TemporalErrorHandler.throwAsApplicationFailure(customError);
      }
      throw error;
    }
  }

  /**
   * Update or create series (for admin API)
   */
  async upsertSeries(
    partnerCode: string,
    seriesStart: number,
    seriesEnd: number,
    isActive: boolean = true
  ) {
    this.logger.log(
      `Upserting AWB series for ${partnerCode}: ${seriesStart} - ${seriesEnd}, active: ${isActive}`
    );

    // Validate that seriesEnd > seriesStart
    if (seriesEnd <= seriesStart) {
      const customError = new CustomHttpException(
        HttpStatus.BAD_REQUEST,
        "Series end must be greater than series start"
      );
      TemporalErrorHandler.throwAsApplicationFailure(customError);
    }

    return this.awbSeriesRepository.upsertSeries(
      partnerCode,
      seriesStart,
      seriesEnd,
      isActive
    );
  }
}
