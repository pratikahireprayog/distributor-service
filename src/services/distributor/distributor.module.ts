import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OrderPartnerRepositoryModule } from "src/common/repositories/order-partner/order-partner.module";
import { NetworkPartnersModule } from "../network-partners/network-partners.module";
import { DistributorService } from "./distributor.service";
import { DiscordAlertService } from "../../infrastructure/alert/discord-alert.service";

/**
 * Module for distributor service
 */
@Module({
  imports: [ConfigModule, NetworkPartnersModule, OrderPartnerRepositoryModule],
  providers: [DistributorService, DiscordAlertService],
  exports: [DistributorService],
})
export class DistributorModule {}
