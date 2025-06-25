import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  DistributorService,
  StandardRequestDto,
} from "../../../services/distributor/distributor.service";
import { ActivityRegistryService } from "./activity-registry.service";
import { BaseOrderReqDto, BaseOrderResDto } from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";

// TODO: Move to dto
// Interface for payload that includes both order data and eligible partners
interface CreateOrderPayload {
  orderData: BaseOrderReqDto;
  partnerCode: string;
  eligiblePartners?: EligiblePartnersData;
}

/**
 * Provider responsible for registering activities with the ActivityRegistryService
 * This centralizes activity registration in one place instead of in main.ts
 */
@Injectable()
export class ActivityRegistrationProvider implements OnModuleInit {
  constructor(
    private readonly activityRegistry: ActivityRegistryService,
    private readonly distributorService: DistributorService
  ) {}

  /**
   * Register all activities when the module initializes
   */
  async onModuleInit() {
    // Register distributor service activities
    await Promise.resolve().then(() => {
      this.activityRegistry.register("", {
        createManifest: this.distributorService.createManifest.bind(
          this.distributorService
        ),
        createOrder: async (
          payload: StandardRequestDto
        ): Promise<BaseOrderResDto> => {
          return this.distributorService.createOrder(payload);
        },
        retryCreateOrder: this.distributorService.retryCreateOrder.bind(
          this.distributorService
        ),
        // distributorTrackOrder: this.distributorService.trackOrder.bind(this.distributorService),
        cancelOrder: this.distributorService.cancelOrder.bind(
          this.distributorService
        ),
        pushOrderToDRS: this.distributorService.pushOrderToDRS.bind(
          this.distributorService
        ),
        pushOrdersToPRS: this.distributorService.pushOrdersToPRS.bind(
          this.distributorService
        ),
        pushOrderToTracking: this.distributorService.pushOrderToTracking.bind(
          this.distributorService
        ),
        manifestOrderToTracking:
          this.distributorService.manifestOrderToTracking.bind(
            this.distributorService
          ),
        updateEcomOrderWebhook:
          this.distributorService.updateEcomOrderWebhook.bind(
            this.distributorService
          ),
        pushOrderToHubOps: this.distributorService.pushOrderToHubOps.bind(
          this.distributorService
        ),
        updateOrderToHubOps: this.distributorService.updateOrderToHubOps.bind(
          this.distributorService
        ),
      });
    });
  }
}
