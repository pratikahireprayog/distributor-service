import { Module } from "@nestjs/common";
import { AwbSeriesAuditRepository } from "./awb-series-audit.repository";
import { awbSeriesAuditProvider } from "./awb-series-audit.provider";
import { DatabaseModule } from "src/infrastructure/database/database.module";

@Module({
  imports: [DatabaseModule],
  providers: [...awbSeriesAuditProvider, AwbSeriesAuditRepository],
  exports: [AwbSeriesAuditRepository],
})
export class AwbSeriesAuditModule {}
