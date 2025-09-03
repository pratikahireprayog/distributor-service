import { Injectable, Logger } from '@nestjs/common';
import { INetworkPartner } from 'src/services/network-partners/interfaces/network-partner.interface';
import { UniuniFactoryService } from '../implementation/uniuni/uniuni-factory.service';

/**
 * Factory service for creating network partner activity instances
 */
@Injectable()
export class NetworkPartnerFactoryService {
    private partnersMap: Map<string, INetworkPartner> = new Map();
    private defaultPartner: INetworkPartner | null = null;
    private readonly logger = new Logger(NetworkPartnerFactoryService.name);
    private uniuniFactory: UniuniFactoryService | null = null;

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
     * Sets the UniUni factory service for country-based routing
     * @param uniuniFactory The UniUni factory service
     */
    setUniuniFactory(uniuniFactory: UniuniFactoryService): void {
        this.uniuniFactory = uniuniFactory;
    }

    /**
     * Gets a network partner activity implementation by type
     * @param type The partner type identifier
     * @param payload Optional payload for country-based routing (used for UniUni)
     * @returns The partner activity implementation
     */
    getPartner(type: string, payload?: any): INetworkPartner {
        // Special handling for UniUni with country-based routing
        if (type === 'UNIUNI' && this.uniuniFactory && this.uniuniFactory.isConfigured()) {
            this.logger.debug('Using UniUni factory for country-based routing');
            return this.uniuniFactory.getUniuniService(payload);
        }

        // Standard partner lookup
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
        // Special check for UniUni
        if (type === 'UNIUNI' && this.uniuniFactory) {
            return this.uniuniFactory.isConfigured();
        }
        
        return this.partnersMap.has(type);
    }
} 