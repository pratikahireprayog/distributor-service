import { Injectable, OnModuleInit } from "@nestjs/common";
import { DistributorService } from "../../../services/distributor/distributor.service";
import { ActivityRegistryService } from "./activity-registry.service";
import { BaseOrderReqDto, BaseOrderResDto } from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";

// TODO: Move to dto
// Interface for payload that includes both order data and eligible partners
interface CreateOrderPayload {
  orderData: BaseOrderReqDto;
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
          payload: CreateOrderPayload
        ): Promise<BaseOrderResDto> => {
          return this.distributorService.createOrder(
            payload.orderData,
            payload.eligiblePartners
          );
        },
        retryCreateOrder: this.distributorService.retryCreateOrder.bind(
          this.distributorService
        ),
        // distributorTrackOrder: this.distributorService.trackOrder.bind(this.distributorService),
        cancelOrder: this.distributorService.cancelOrder.bind(
          this.distributorService
        ),

        createDRS: this.distributorService.createDRS.bind(
          this.distributorService
        ),
      });
    });
  }
}
