import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthProvider } from '../../interfaces/auth-provider.interface';
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
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    this.logger.debug('Getting FEDEX authentication headers');
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    };
  }

  /**
   * Gets an OAuth2 token for FedEx API (with caching)
   */
  async getToken(): Promise<string> {
    this.logger.debug('Getting FEDEX OAuth token');

    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }

    const authUrl = FEDEX_URLS.AUTH_URL;
    const clientId = this.configService.get<string>('FEDEX_CLIENT_ID');
    const clientSecret = this.configService.get<string>('FEDEX_CLIENT_SECRET');

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
