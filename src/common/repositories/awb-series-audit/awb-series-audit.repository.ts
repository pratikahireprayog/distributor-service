import { Model } from "mongoose";
import { Inject, Injectable } from "@nestjs/common";
import { AwbSeriesAuditDocument } from "./awb-series-audit.schema";
import { REPOSITORY_MODEL_PROVIDER_CONST } from "src/common/constants";
import { BaseMongoRepository } from "src/common/repositories/base/database.abstract";

@Injectable()
export class AwbSeriesAuditRepository extends BaseMongoRepository<AwbSeriesAuditDocument> {
  constructor(
    @Inject(REPOSITORY_MODEL_PROVIDER_CONST.AWB_SERIES_AUDIT_MODEL)
    private readonly awbSeriesAuditModel: Model<AwbSeriesAuditDocument>
  ) {
    super(awbSeriesAuditModel);
  }

  /**
   * Create audit log for AWB assignment
   */
  async logAwbAssignment(
    seriesId: string,
    partnerCode: string,
    awbNumber: string,
    orderId: string,
    awbType: string
  ): Promise<AwbSeriesAuditDocument> {
    return this.create({
      seriesId,
      partnerCode,
      awbNumber,
      orderId,
      consumedAt: new Date(),
      awbType,
    });
  }

  /**
   * Get audit logs for an order
   */
  async getAuditLogsByOrderId(
    orderId: string
  ): Promise<AwbSeriesAuditDocument[]> {
    return this.awbSeriesAuditModel.find({ orderId }).exec();
  }

  /**
   * Get audit logs for a series
   */
  async getAuditLogsBySeriesId(
    seriesId: string
  ): Promise<AwbSeriesAuditDocument[]> {
    return this.awbSeriesAuditModel
      .find({ seriesId })
      .sort({ consumedAt: -1 })
      .exec();
  }
}
