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
    onModuleInit() {
        // Register distributor service activities
        this.activityRegistry.register('distributor', {
            createManifest: this.distributorService.createManifest.bind(this.distributorService),
            // trackOrder: this.distributorService.trackOrder.bind(this.distributorService),
            // cancelOrder: this.distributorService.cancelOrder.bind(this.distributorService),
        });
    }
} 