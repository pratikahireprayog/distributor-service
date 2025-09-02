import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AuthProvider } from '../../interfaces/auth-provider.interface';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class UniuniAuthService implements AuthProvider {
  private readonly logger = new Logger(UniuniAuthService.name);
  
  // Store tokens per country
  private tokens: Map<string, { token: string; expiry: number }> = new Map();
  private tokenRefreshInProgress: Map<string, Promise<string>> = new Map();

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
    const tokenKey = 'UNIUNI_TOKEN';
    
    // Check if token is still valid (with 5 minute buffer)
    const tokenInfo = this.tokens.get(tokenKey);
    if (tokenInfo && tokenInfo.expiry > Date.now() + (5 * 60 * 1000)) {
      return tokenInfo.token;
    }

    // Prevent multiple concurrent token requests
    if (this.tokenRefreshInProgress.has(tokenKey)) {
      return this.tokenRefreshInProgress.get(tokenKey)!;
    }

    const refreshPromise = this.refreshToken();
    this.tokenRefreshInProgress.set(tokenKey, refreshPromise);
    
    try {
      const token = await refreshPromise;
      return token;
    } finally {
      this.tokenRefreshInProgress.delete(tokenKey);
    }
  }

  private async refreshToken(): Promise<string> {
    try {
      this.logger.debug('Refreshing UNIUNI authentication token');
      
      const authConfig = this.getAuthConfig();
      this.logger.debug(`UNIUNI auth config: URL=${authConfig.url}, clientId=${authConfig.payload.client_id}`);
      
      const response = await firstValueFrom(
        this.httpService.post(authConfig.url, authConfig.payload)
      );
      
      this.logger.debug(`UNIUNI auth response: ${JSON.stringify(response.data)}`);

      // Handle the actual UNIUNI API response format
      if (response.data && response.data.status === 'SUCCESS' && response.data.data && response.data.data.access_token) {
        const token = response.data.data.access_token;
        const expiresIn = response.data.data.expires_in;
        
        let expiryTime: number;
        if (expiresIn) {
          // Convert to milliseconds if it's in seconds
          expiryTime = expiresIn > 1000000000 ? expiresIn : expiresIn * 1000;
        } else {
          expiryTime = Date.now() + (3600 * 1000); // Default 1 hour
        }
        
        this.tokens.set('UNIUNI_TOKEN', { token, expiry: expiryTime });
        this.logger.debug(`UNIUNI token refreshed successfully. Expires at: ${new Date(expiryTime).toISOString()}`);
        
        return token;
      } else {
        throw new Error(`Invalid response from UNIUNI auth API: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      this.logger.error(`Failed to refresh UNIUNI token: ${error.message}`);
      throw new Error(`UNIUNI authentication failed: ${error.message}`);
    }
  }

  private getAuthConfig(): { url: string; payload: any } {
    const clientId = this.configService.get<string>('UNIUNI_CLIENT_ID', '100552');
    const clientSecret = this.configService.get<string>('UNIUNI_CLIENT_SECRET', 'acad964f336dff02415362087539c9f2');
    const authUrl = this.configService.get<string>('UNIUNI_AUTH_URL', 'https://sjqa.uniexpress.org/storeauth/customertoken');
    
    return {
      url: authUrl,
      payload: {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }
    };
  }
}

