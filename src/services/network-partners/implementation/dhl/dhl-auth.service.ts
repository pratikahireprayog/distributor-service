import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, TenantContext } from '../../interfaces/auth-provider.interface';

/**
 * DHL authentication provider
 */
@Injectable()
export class DHLAuthService implements AuthProvider {
  private readonly logger = new Logger(DHLAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Gets authentication headers for DHL API
   * @param tenantContext Optional tenant context for tenant-specific credentials
   */
  async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
    this.logger.debug('Getting DHL authentication headers');
    
    const authToken = this.configService.get<string>('DHL_AUTH_TOKEN') || "";
    
    return {
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    };
  }

  /**
   * Gets a token for DHL API
   */
  async getToken(): Promise<string | null> {
    this.logger.debug('Getting DHL authentication token');
    return this.configService.get<string>('DHL_AUTH_TOKEN') || '';
  }
} 