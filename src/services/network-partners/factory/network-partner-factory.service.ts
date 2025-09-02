import { Injectable, Logger } from '@nestjs/common';
import { INetworkPartner } from 'src/services/network-partners/interfaces/network-partner.interface';

/**
 * Factory service for creating network partner activity instances
 */
@Injectable()
export class NetworkPartnerFactoryService {
    private partnersMap: Map<string, INetworkPartner> = new Map();
    private defaultPartner: INetworkPartner | null = null;
    private readonly logger = new Logger(NetworkPartnerFactoryService.name);

    constructor() { }

    /**
     * Registers a network partner activity implementation
     * @param type The partner type identifier
     * @param partner The partner activity implementation
     */
    registerPartner(type: string, partner: INetworkPartner): void {
        if (this.partnersMap.has(type)) {
            throw new Error(`Partner with type ${type} is already registered`);
        }
        this.partnersMap.set(type, partner);
    }

    /**
     * Registers a default partner to use when a specific partner is not found
     * @param partner The default partner implementation
     */
    registerDefaultPartner(partner: INetworkPartner): void {
        this.defaultPartner = partner;
    }

    /**
     * Gets a network partner activity implementation by type
     * @param type The partner type identifier
     * @returns The partner activity implementation
     */
    getPartner(type: string): INetworkPartner {
        const partner = this.partnersMap.get(type);
        if (!partner) {
            if (this.defaultPartner) {
                this.logger.warn(`Using default partner for type: ${type}`);
                return this.defaultPartner;
            }
            throw new Error(`Network partner not found for type: ${type} and no default partner is registered`);
        }
        return partner;
    }

    /**
     * Checks if a partner with the given type exists
     * @param type The partner type identifier
     * @returns True if the partner exists, false otherwise
     */
    hasPartner(type: string): boolean {
        return this.partnersMap.has(type);
    }
} 