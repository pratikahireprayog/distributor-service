import { Injectable, Logger } from '@nestjs/common';
import { AuthProvider, TenantContext } from '../../interfaces/auth-provider.interface';

/**
 * Default authentication provider for the default network partner
 */
@Injectable()
export class DefaultAuthService implements AuthProvider {
  private readonly logger = new Logger(DefaultAuthService.name);

  constructor() {}

  /**
   * Gets authentication headers for the default network partner
   * This implementation just returns an empty object since it's a default provider
   * @param tenantContext Optional tenant context (not used in default provider)
   */
  async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
    this.logger.debug('Using default authentication provider');
    return {};
  }

  /**
   * Gets a token for the default network partner
   * This implementation just returns null since it's a default provider
   */
  async getToken(): Promise<string | null> {
    this.logger.debug('Using default authentication provider');
    return null;
  }
} 