import { Injectable, Logger } from '@nestjs/common';
import { NetworkPartnerFactoryService } from 'src/services/network-partners/network-partner-factory.service';

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
    //     return partnerActivity.createManifest(data);
    // }

    /**
     * Creates a manifestation with the appropriate network partner
     * @param data The manifestation data
     * @returns The created manifestation
     */
    async createManifest(data: any): Promise<any> {
        this.logger.log(`Creating manifestation for ${data.manifestationId || 'unknown'}`);

        // Determine which partner to use
        const partnerType = this.determinePartner(data);
        this.logger.debug(`Selected partner: ${partnerType}`);

        // Get the appropriate partner implementation
        const partnerActivity = this.networkPartnerFactory.getPartner(partnerType);

        // Execute the operation with the selected partner
        return partnerActivity.createManifest(data);
    }

    /**
     * Determines the order type from the payload
     * @param data The incoming payload data
     * @returns The order type (e.g., 'CARGO', 'ECOM')
     */
    private determineOrderType(data: any): string {
        const orderType = data.type?.toUpperCase();

        if (!orderType) {
            this.logger.warn('Order type not specified in payload');
            throw new Error('Order type is required');
        }

        this.logger.debug(`Determined order type: ${orderType}`);
        return orderType;
    }

    /**
     * Determines the partner code from the payload
     * @param data The incoming payload data
     * @returns The partner code or null if not specified
     */
    private determinePartner(data: any): string | null {
        const partnerCode = data.partnerCode;

        if (!partnerCode) {
            this.logger.debug('Partner code not specified in payload');
            return null;
        }

        this.logger.debug(`Determined partner: ${partnerCode}`);
        return partnerCode;
    }

    /**
     * Determines the sub-partner code from the payload
     * @param data The incoming payload data
     * @returns The sub-partner code or null if not specified
     */
    private determineSubPartner(data: any): string | null {
        const subPartnerCode = data.subPartnerCode;

        if (!subPartnerCode) {
            this.logger.debug('Sub-partner code not specified in payload');
            return null;
        }

        this.logger.debug(`Determined sub-partner: ${subPartnerCode}`);
        return subPartnerCode;
    }
} 