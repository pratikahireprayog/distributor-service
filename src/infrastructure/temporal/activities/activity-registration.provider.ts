import { Injectable, OnModuleInit } from '@nestjs/common';
import { DistributorService } from '../../../services/distributor/distributor.service';
import { ActivityRegistryService } from './activity-registry.service';

/**
 * Provider responsible for registering activities with the ActivityRegistryService
 * This centralizes activity registration in one place instead of in main.ts
 */
@Injectable()
export class ActivityRegistrationProvider implements OnModuleInit {
    constructor(
        private readonly activityRegistry: ActivityRegistryService,
        private readonly distributorService: DistributorService,
    ) { }

    /**
     * Register all activities when the module initializes
     */
    async onModuleInit() {
        // Register distributor service activities
        await Promise.resolve().then(() => {
            this.activityRegistry.register('', {
                distributorCreateManifest: this.distributorService.createManifest.bind(this.distributorService),
                createManifest: this.distributorService.createManifest.bind(this.distributorService),
                // distributorTrackOrder: this.distributorService.trackOrder.bind(this.distributorService),
                // distributorCancelOrder: this.distributorService.cancelOrder.bind(this.distributorService),
            });
        });
    }
}