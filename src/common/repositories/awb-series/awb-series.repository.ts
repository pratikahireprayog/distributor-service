import { Model } from "mongoose";
import { Inject, Injectable } from "@nestjs/common";
import { AwbSeriesDocument } from "./awb-series.schema";
import { REPOSITORY_MODEL_PROVIDER_CONST } from "src/common/constants";
import { BaseMongoRepository } from "src/common/repositories/base/database.abstract";

@Injectable()
export class AwbSeriesRepository extends BaseMongoRepository<AwbSeriesDocument> {
  constructor(
    @Inject(REPOSITORY_MODEL_PROVIDER_CONST.AWB_SERIES_MODEL)
    private readonly awbSeriesModel: Model<AwbSeriesDocument>
  ) {
    super(awbSeriesModel);
  }

  /**
   * Atomically increment the counter and return the updated series
   * This ensures thread-safe counter increments
   * Only increments if series is active and not exhausted (currentCounter <= seriesEnd)
   */
  async incrementCounter(
    partnerCode: string
  ): Promise<AwbSeriesDocument | null> {
    return this.awbSeriesModel
      .findOneAndUpdate(
        {
          partnerCode,
          isActive: true,
          $expr: { $lte: ["$currentCounter", "$seriesEnd"] }, // Only increment if not exhausted
        },
        { $inc: { currentCounter: 1 } },
        { new: true } // Return updated document
      )
      .exec();
  }

  /**
   * Add a threshold to the notificationThresholds array
   */
  async addNotificationThreshold(
    partnerCode: string,
    threshold: number
  ): Promise<AwbSeriesDocument | null> {
    return this.awbSeriesModel
      .findOneAndUpdate(
        { partnerCode },
        { $addToSet: { notificationThresholds: threshold } },
        { new: true }
      )
      .exec();
  }

  /**
   * Get active series for a partner
   */
  async getActiveSeriesForPartner(
    partnerCode: string
  ): Promise<AwbSeriesDocument | null> {
    return this.awbSeriesModel.findOne({ partnerCode, isActive: true }).exec();
  }

  /**
   * Create a new series (throws error if already exists)
   */
  async createSeries(
    partnerCode: string,
    seriesStart: number,
    seriesEnd: number
  ): Promise<AwbSeriesDocument> {
    // Check if series already exists for this partner
    const existingSeries = await this.awbSeriesModel
      .findOne({ partnerCode })
      .exec();

    if (existingSeries) {
      throw new Error(
        `AWB series already exists for partner: ${partnerCode}. Use update endpoint to modify existing series.`
      );
    }

    // Create new series
    return this.create({
      partnerCode,
      seriesStart,
      seriesEnd,
      currentCounter: seriesStart,
      isActive: true,
      notificationThresholds: [],
    });
  }

  /**
   * Update or create series (upsert)
   */
  async upsertSeries(
    partnerCode: string,
    seriesStart: number,
    seriesEnd: number,
    isActive: boolean = true
  ): Promise<AwbSeriesDocument> {
    return this.awbSeriesModel
      .findOneAndUpdate(
        { partnerCode },
        {
          $set: {
            seriesStart,
            seriesEnd,
            isActive,
          },
          $setOnInsert: {
            currentCounter: seriesStart,
            notificationThresholds: [],
          },
        },
        { new: true, upsert: true }
      )
      .exec();
  }
}
