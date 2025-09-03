import { Injectable, Logger } from '@nestjs/common';
import { INetworkPartner } from '../../interfaces/network-partner.interface';
import { UniuniService } from './uniuni.service';

/**
 * Factory service for creating UniUni network partner instances
 */
@Injectable()
export class UniuniFactoryService {
    private readonly logger = new Logger(UniuniFactoryService.name);
    private uniuniService: UniuniService;

    constructor() {}

    /**
     * Sets the UniUni service instance
     * @param service The UniUni service implementation
     */
    setUniuniService(service: UniuniService): void {
        this.uniuniService = service;
    }

    /**
     * Gets the UniUni service
     * @param payload The request payload (not used in simplified version)
     * @returns The UniUni service implementation
     */
    getUniuniService(payload: any): INetworkPartner {
        if (!this.uniuniService) {
            throw new Error('UniUni service not configured');
        }
        
        // Return the service directly since we simplified it
        return this.uniuniService;
    }

    /**
     * Checks if the factory has the UniUni service configured
     * @returns True if the service is configured, false otherwise
     */
    isConfigured(): boolean {
        return !!this.uniuniService;
    }
}
