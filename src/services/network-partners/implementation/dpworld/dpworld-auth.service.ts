import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, TenantContext } from '../../interfaces/auth-provider.interface';
import { DPWORLD_ENV_KEYS } from './dpworld-constants';

/**
 * Authentication service for DPWORLD
 * Handles API key and organization token authentication
 */
@Injectable()
export class DpworldAuthService implements AuthProvider {
  private readonly logger = new Logger(DpworldAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get authentication headers for DPWORLD API
   * @returns Headers object with API key and org token
   */
  async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
    const apiKey = this.configService.get<string>(DPWORLD_ENV_KEYS.API_KEY);
    const orgToken = this.configService.get<string>(DPWORLD_ENV_KEYS.ORG_TOKEN);

    if (!apiKey || !orgToken) {
      this.logger.error('DPWORLD API credentials not configured');
      throw new Error('DPWORLD API credentials (API_KEY or ORG_TOKEN) are not configured');
    }

    return {
      'accept': 'application/json',
      'X-DPW-ApiKey': apiKey,
      'X-DPW-Org-Token': orgToken,
      'Content-Type': 'application/json',
    };
  }
}
