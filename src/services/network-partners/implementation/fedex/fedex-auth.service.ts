import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthProvider, TenantContext } from '../../interfaces/auth-provider.interface';
import { FEDEX_URLS } from './fedex-constants';

/**
 * FEDEX authentication provider
 */
@Injectable()
export class FEDEXAuthService implements AuthProvider {
  private readonly logger = new Logger(FEDEXAuthService.name);
  private tokenCache: { accessToken: string; expiresAt: number } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) { }

  /**
   * Gets authentication headers for FedEx API
   * Uses tenant-specific credentials if available, otherwise falls back to default
   */
  async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
    this.logger.debug('Getting FEDEX authentication headers');
    const token = await this.getToken(tenantContext);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    };
  }

  /**
   * Gets an OAuth2 token for FedEx API (with caching)
   * Uses tenant-specific credentials if available in tenantContext
   */
  async getToken(tenantContext?: TenantContext): Promise<string> {
    this.logger.debug('Getting FEDEX OAuth token');

    // Only use cache for default credentials, not tenant-specific
    if (!tenantContext?.partnerCredentials && this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }

    const authUrl = FEDEX_URLS.AUTH_URL;
    
    // Use tenant-specific credentials if available, otherwise use default
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    if (tenantContext?.partnerCredentials && tenantContext.partnerCredentials.length > 0) {
      // Extract credentials from tenant context
      const clientIdCred = tenantContext.partnerCredentials.find(c => 
        c.key.toLowerCase() === 'client_id' || c.key.toLowerCase() === 'fedex_client_id'
      );
      const clientSecretCred = tenantContext.partnerCredentials.find(c => 
        c.key.toLowerCase() === 'client_secret' || c.key.toLowerCase() === 'fedex_client_secret'
      );
      
      clientId = clientIdCred?.value;
      clientSecret = clientSecretCred?.value;
      
      if (clientId && clientSecret) {
        this.logger.debug(`Using tenant-specific credentials for tenant: ${tenantContext.tenantId}`);
      }
    }

    // Fallback to default credentials if tenant credentials not found
    if (!clientId || !clientSecret) {
      clientId = this.configService.get<string>('FEDEX_CLIENT_ID');
      clientSecret = this.configService.get<string>('FEDEX_CLIENT_SECRET');
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await firstValueFrom(
      this.httpService.post(authUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
    );

    const { access_token, expires_in } = response.data;

    this.tokenCache = {
      accessToken: access_token,
      expiresAt: Date.now() + (expires_in - 60) * 1000,
    };

    return access_token;
  }
}
