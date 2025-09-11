import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '../../interfaces/auth-provider.interface';

/**
 * ARAMEX authentication provider
 */
@Injectable()
export class ARAMEXAuthService implements AuthProvider {
  private readonly logger = new Logger(ARAMEXAuthService.name);

  constructor(private readonly configService: ConfigService) { }

  /**
   * Gets authentication headers for ARAMEX API
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    this.logger.debug('Getting ARAMEX authentication headers');

    const authToken = this.configService.get<string>('ARAMEX_AUTH_TOKEN') || "";

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