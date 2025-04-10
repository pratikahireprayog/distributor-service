import { Module } from "@nestjs/common";
import { OrderPartnerRepository } from "./order-partner.repository";
import { OrderPartnerHistoryRepository } from "./order-partner-history.repository";
import { orderPartnerProvider } from "./order-partner.provider";
import { orderPartnerHistoryProvider } from "./order-partner-history.provider";
import { DatabaseModule } from "src/infrastructure/database/database.module";

@Module({
  imports: [DatabaseModule],
  providers: [
    OrderPartnerRepository,
    OrderPartnerHistoryRepository,
    ...orderPartnerProvider,
    ...orderPartnerHistoryProvider,
  ],
  exports: [OrderPartnerRepository, OrderPartnerHistoryRepository],
})
export class OrderPartnerRepositoryModule {}
