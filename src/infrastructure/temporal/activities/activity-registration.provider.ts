import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  DistributorService,
  StandardRequestDto,
  StandardRequestDtoV2,
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
        createOrderV2: async(
          payload: StandardRequestDtoV2 | { order?: any; orders?: any; partnerCode?: string; eligiblePartners?: any; headers?: Record<string, string> }
        ): Promise<BaseOrderResDto> => {
          // Extract headers if they exist in the payload
          let tenantId: string | undefined;
          let userId: string | undefined;
          let requestDto: StandardRequestDtoV2;

          // Check if payload has headers property (from workflow)
          if (payload && typeof payload === 'object' && 'headers' in payload) {
            const payloadWithHeaders = payload as any;
            const headers = payloadWithHeaders.headers || {};
            
            // Extract tenant and user IDs from headers (case-insensitive)
            tenantId = headers['x-tenant-id'] || headers['X-Tenant-Id'] || headers['X-TENANT-ID'];
            userId = headers['x-user-id'] || headers['X-User-Id'] || headers['X-USER-ID'];
            
            // Create clean request DTO without headers
            requestDto = {
              order: payloadWithHeaders.order,
              orders: payloadWithHeaders.orders,
              partnerCode: payloadWithHeaders.partnerCode,
              eligiblePartners: payloadWithHeaders.eligiblePartners,
            } as StandardRequestDtoV2;
          } else {
            // Standard payload without headers
            requestDto = payload as StandardRequestDtoV2;
          }

          return this.distributorService.createOrderV2(requestDto, tenantId, userId);
        },
        retryCreateOrder: this.distributorService.retryCreateOrder.bind(
          this.distributorService
        ),
        // distributorTrackOrder: this.distributorService.trackOrder.bind(this.distributorService),
        cancelOrder: this.distributorService.cancelOrder.bind(
          this.distributorService
        ),
        cancelOrderV2: this.distributorService.cancelOrderV2.bind(
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
        pushOrderToHubOpsV2: this.distributorService.pushOrderToHubOpsV2.bind(
          this.distributorService
        ),
        updateOrderToHubOps: this.distributorService.updateOrderToHubOps.bind(
          this.distributorService
        ),
        updatePartnerToHubOps: this.distributorService.updatePartnerToHubOps.bind(
          this.distributorService
        ),
      });
    });
  }
}
