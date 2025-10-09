import { Module } from "@nestjs/common";
import { AwbSeriesRepository } from "./awb-series.repository";
import { awbSeriesProvider } from "./awb-series.provider";
import { DatabaseModule } from "src/infrastructure/database/database.module";

@Module({
  imports: [DatabaseModule],
  providers: [...awbSeriesProvider, AwbSeriesRepository],
  exports: [AwbSeriesRepository],
})
export class AwbSeriesModule {}
