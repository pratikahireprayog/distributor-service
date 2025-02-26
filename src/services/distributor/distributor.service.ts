import { Injectable, Logger } from '@nestjs/common';
import { NetworkPartnerFactoryService } from '../network-partners/factory/network-partner-factory.service';

/**
 * Service for distributing operations to network partners
 */
@Injectable()
export class DistributorService {
    private readonly logger = new Logger(DistributorService.name);

    constructor(
        private readonly networkPartnerFactory: NetworkPartnerFactoryService,
    ) { }

    /**
     * Creates an order with the appropriate network partner
     * @param data The order data
     * @returns The created order
     */
    // async createOrder(data: any): Promise<any> {
    //     this.logger.log(`Creating order for ${data.orderId}`);

    //     // Determine which partner to use
    //     const partnerType = this.determinePartnerType(data);
    //     this.logger.debug(`Selected partner: ${partnerType}`);

    //     // Get the appropriate partner implementation
    //     const partnerActivity = this.networkPartnerFactory.getPartner(partnerType);

    //     // Execute the operation with the selected partner
    //     return partnerActivity.createManifestation(data);
    // }

    /**
     * Creates a manifestation with the appropriate network partner
     * @param data The manifestation data
     * @returns The created manifestation
     */
    async createManifestation(data: any): Promise<any> {
        this.logger.log(`Creating manifestation for ${data.manifestationId || 'unknown'}`);

        // Determine which partner to use
        const partnerType = this.determinePartnerType(data);
        this.logger.debug(`Selected partner: ${partnerType}`);

        // Get the appropriate partner implementation
        const partnerActivity = this.networkPartnerFactory.getPartner(partnerType);

        // Execute the operation with the selected partner
        return partnerActivity.createManifestation(data);
    }

    /**
     * Tracks a shipment with the appropriate network partner
     * @param trackingId The tracking ID
     * @returns The tracking information
     */
    // async trackOrder(trackingId: string): Promise<any> {
    //     this.logger.log(`Tracking order with ID ${trackingId}`);

    //     // Determine partner from tracking ID
    //     const partnerType = await this.findPartnerForTrackingId(trackingId);

    //     // Get the appropriate partner implementation
    //     const partnerActivity = this.networkPartnerFactory.getPartner(partnerType);

    //     // Execute the operation with the selected partner
    //     return partnerActivity.trackOrder(trackingId);
    // }

    /**
     * Cancels an order with the appropriate network partner
     * @param shipmentId The shipment ID
     * @returns The cancellation result
     */
    // async cancelOrder(shipmentId: string): Promise<any> {
    //     this.logger.log(`Cancelling order with ID ${shipmentId}`);

    //     // Find partner for this shipment
    //     const partnerId = await this.findPartnerForShipmentId(shipmentId);

    //     // Get the appropriate partner implementation
    //     const partnerActivity = this.networkPartnerFactory.getPartner(partnerId);

    //     // Execute the operation with the selected partner
    //     return partnerActivity.cancelOrder(shipmentId);
    // }

    /**
     * Determines the partner type to use for a given order
     * @param data The order data
     * @returns The partner type
     */
    private determinePartnerType(data: any): string {
        const pincode = data.delivery?.pincode;

        // Example business rules for partner selection
        if (this.isPremiumOrder(data)) {
            return 'ekart';
        } else if (this.isSpecialRegion(pincode)) {
            return 'delhivery';
        } else if (data.isAirDelivery) {
            return 'bigship';
        }

        return 'ecom_express';
    }

    /**
     * Checks if an order is a premium order
     * @param data The order data
     * @returns Whether the order is premium
     */
    private isPremiumOrder(data: any): boolean {
        return data.isPremium || data.totalValue > 10000;
    }

    /**
     * Checks if a pincode is in a special region
     * @param pincode The pincode
     * @returns Whether the pincode is in a special region
     */
    private isSpecialRegion(pincode: string): boolean {
        return ['110001', '400001', '700001'].includes(pincode);
    }

    /**
     * Finds the partner for a tracking ID
     * @param trackingId The tracking ID
     * @returns The partner type
     */
    private async findPartnerForTrackingId(trackingId: string): Promise<string> {
        // This would typically involve looking up the tracking ID in your database
        // to determine which partner it belongs to
        // For simplicity, I'm returning a default value
        if (trackingId.startsWith('EK')) {
            return 'ekart';
        } else if (trackingId.startsWith('DL')) {
            return 'delhivery';
        } else if (trackingId.startsWith('BS')) {
            return 'bigship';
        }
        return 'ecom_express';
    }

    /**
     * Finds the partner for a shipment ID
     * @param shipmentId The shipment ID
     * @returns The partner type
     */
    private async findPartnerForShipmentId(shipmentId: string): Promise<string> {
        // This would typically involve looking up the shipment ID in your database
        // For simplicity, I'm returning a default value based on prefix
        if (shipmentId.startsWith('EK')) {
            return 'ekart';
        } else if (shipmentId.startsWith('DL')) {
            return 'delhivery';
        } else if (shipmentId.startsWith('BS')) {
            return 'bigship';
        }
        return 'ecom_express';
    }
} 