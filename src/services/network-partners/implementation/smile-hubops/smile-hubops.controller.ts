import { Controller, Post, Body, Logger } from "@nestjs/common";
import { AwbSeriesService } from "./awb-series.service";
import { IsString, IsNumber, IsBoolean, IsOptional } from "class-validator";

/**
 * DTO for creating a new AWB Series
 */
export class CreateAwbSeriesDto {
  @IsString()
  partnerCode: string;

  @IsNumber()
  seriesStart: number;

  @IsNumber()
  seriesEnd: number;
}

/**
 * DTO for AWB Series update request
 */
export class UpdateAwbSeriesDto {
  @IsString()
  partnerCode: string;

  @IsNumber()
  seriesStart: number;

  @IsNumber()
  seriesEnd: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Admin controller for managing AWB series
 */
@Controller("admin/awb-series")
export class SmileHubopsController {
  private readonly logger = new Logger(SmileHubopsController.name);

  constructor(private readonly awbSeriesService: AwbSeriesService) {}

  /**
   * Create a new AWB series for a partner
   * POST /admin/awb-series/create
   */
  @Post("create")
  async createAwbSeries(@Body() createDto: CreateAwbSeriesDto) {
    this.logger.log(
      `Creating new AWB series for partner: ${createDto.partnerCode}`
    );

    try {
      const series = await this.awbSeriesService.createSeries(
        createDto.partnerCode,
        createDto.seriesStart,
        createDto.seriesEnd
      );

      this.logger.log(
        `AWB series created successfully for ${createDto.partnerCode}: ${series._id}`
      );

      return {
        statusCode: 201,
        message: "AWB series created successfully",
        data: {
          id: series._id,
          partnerCode: series.partnerCode,
          seriesStart: series.seriesStart,
          seriesEnd: series.seriesEnd,
          currentCounter: series.currentCounter,
          isActive: series.isActive,
          totalCapacity: series.seriesEnd - series.seriesStart + 1,
          consumed: 0,
          remaining: series.seriesEnd - series.currentCounter,
          consumptionPercentage: "0.00",
          notificationThresholds: series.notificationThresholds,
          createdAt: series.createdAt,
          updatedAt: series.updatedAt,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to create AWB series for ${createDto.partnerCode}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Update existing AWB series for a partner
   * POST /admin/awb-series/update
   */
  @Post("update")
  async updateAwbSeries(@Body() updateDto: UpdateAwbSeriesDto) {
    this.logger.log(
      `Updating AWB series for partner: ${updateDto.partnerCode}`
    );

    const series = await this.awbSeriesService.upsertSeries(
      updateDto.partnerCode,
      updateDto.seriesStart,
      updateDto.seriesEnd,
      updateDto.isActive !== undefined ? updateDto.isActive : true
    );

    this.logger.log(
      `AWB series updated successfully for ${updateDto.partnerCode}: ${series._id}`
    );

    return {
      statusCode: 200,
      message: "AWB series updated successfully",
      data: {
        id: series._id,
        partnerCode: series.partnerCode,
        seriesStart: series.seriesStart,
        seriesEnd: series.seriesEnd,
        currentCounter: series.currentCounter,
        isActive: series.isActive,
        totalCapacity: series.seriesEnd - series.seriesStart + 1,
        consumed: series.currentCounter - series.seriesStart,
        remaining: series.seriesEnd - series.currentCounter,
        consumptionPercentage: (
          ((series.currentCounter - series.seriesStart) /
            (series.seriesEnd - series.seriesStart + 1)) *
          100
        ).toFixed(2),
        notificationThresholds: series.notificationThresholds,
        createdAt: series.createdAt,
        updatedAt: series.updatedAt,
      },
    };
  }
}
