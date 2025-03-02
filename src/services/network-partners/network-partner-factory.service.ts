import { Injectable } from '@nestjs/common';
import { INetworkPartnerActivity } from 'src/common/interfaces/network-partner-activity.interface';

/**
 * Factory service for creating network partner activity instances
 */
@Injectable()
export class NetworkPartnerFactoryService {
    private partnersMap: Map<string, INetworkPartnerActivity> = new Map();

    constructor() { }

    /**
     * Registers a network partner activity implementation
     * @param type The partner type identifier
     * @param partner The partner activity implementation
     */
    registerPartner(type: string, partner: INetworkPartnerActivity): void {
        if (this.partnersMap.has(type)) {
            throw new Error(`Partner with type ${type} is already registered`);
        }
        this.partnersMap.set(type, partner);
    }

    /**
     * Gets a network partner activity implementation by type
     * @param type The partner type identifier
     * @returns The partner activity implementation
     */
    getPartner(type: string): INetworkPartnerActivity {
        const partner = this.partnersMap.get(type);
        if (!partner) {
            throw new Error(`Network partner not found for type: ${type}`);
        }
        return partner;
    }
} 