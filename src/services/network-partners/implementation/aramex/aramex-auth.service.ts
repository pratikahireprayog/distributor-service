import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, TenantContext } from '../../interfaces/auth-provider.interface';

/**
 * ARAMEX authentication provider
 */
@Injectable()
export class ARAMEXAuthService implements AuthProvider {
  private readonly logger = new Logger(ARAMEXAuthService.name);

  constructor(private readonly configService: ConfigService) { }

  /**
   * Gets authentication headers for ARAMEX API
   * Uses tenant-specific credentials if available, otherwise falls back to default
   * @param tenantContext Optional tenant context for tenant-specific credentials
   */
  async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
    this.logger.debug('Getting ARAMEX authentication headers');

    // Use tenant-specific credentials if available, otherwise use default
    let authToken: string | undefined;

    if (tenantContext?.partnerCredentials && tenantContext.partnerCredentials.length > 0) {
      // Extract auth token from tenant context
      const tokenCred = tenantContext.partnerCredentials.find(c => 
        c.key.toLowerCase() === 'auth_token' || c.key.toLowerCase() === 'aramex_auth_token' || c.key.toLowerCase() === 'token'
      );
      
      authToken = tokenCred?.value;
      
      if (authToken) {
        this.logger.debug(`Using tenant-specific credentials for tenant: ${tenantContext.tenantId}`);
      }
    }

    // Fallback to default credentials if tenant credentials not found
    if (!authToken) {
      authToken = this.configService.get<string>('ARAMEX_AUTH_TOKEN') || "";
    }

    return {
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    };
  }

  /**
   * Gets a token for ARAMEX API
   */
  async getToken(): Promise<string | null> {
    this.logger.debug('Getting ARAMEX authentication token');
    return this.configService.get<string>('ARAMEX_AUTH_TOKEN') || '';
  }
} 