import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AuthProvider } from '../../interfaces/auth-provider.interface';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class UniuniAuthService implements AuthProvider {
  private readonly logger = new Logger(UniuniAuthService.name);
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private isTokenRefreshInProgress: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async getToken(): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    if (this.token && this.tokenExpiry > Date.now() + (5 * 60 * 1000)) {
      return this.token;
    }

    // Prevent multiple concurrent token requests
    if (this.isTokenRefreshInProgress) {
      return this.isTokenRefreshInProgress;
    }

    this.isTokenRefreshInProgress = this.refreshToken();
    try {
      const token = await this.isTokenRefreshInProgress;
      return token;
    } finally {
      this.isTokenRefreshInProgress = null;
    }
  }

  private async refreshToken(): Promise<string> {
    try {
      this.logger.debug('Refreshing UNIUNI authentication token');
      
      const clientId = this.configService.get<string>('UNIUNI_CLIENT_ID', '100552');
      const clientSecret = this.configService.get<string>('UNIUNI_CLIENT_SECRET', 'acad964f336dff02415362087539c9f2');
      const authUrl = this.configService.get<string>('UNIUNI_AUTH_URL', 'https://sjqa.uniexpress.org/storeauth/customertoken');

      const response = await firstValueFrom(
        this.httpService.post(authUrl, {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        })
      );

      // Handle the actual UNIUNI API response format
      if (response.data && response.data.status === 'SUCCESS' && response.data.data && response.data.data.access_token) {
        this.token = response.data.data.access_token;
        const expiresIn = response.data.data.expires_in;
        if (expiresIn) {
          this.tokenExpiry = expiresIn > 1000000000 ? expiresIn * 1000 : expiresIn;
        } else {
          this.tokenExpiry = Date.now() + (3600 * 1000);
        }
        this.logger.debug(`UNIUNI token refreshed successfully. Expires at: ${new Date(this.tokenExpiry).toISOString()}`);
      } else {
        throw new Error(`Invalid response from UNIUNI auth API: ${JSON.stringify(response.data)}`);
      }

      return this.token;
    } catch (error) {
      this.logger.error(`Failed to refresh UNIUNI token: ${error.message}`);
      throw new Error(`UNIUNI authentication failed: ${error.message}`);
    }
  }
}

