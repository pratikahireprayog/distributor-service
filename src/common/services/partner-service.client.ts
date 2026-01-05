import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Partner credentials structure
 */
export interface PartnerCredential {
  key: string;
  value: string;
  partnerCode: string;
}

/**
 * Client for interacting with Partner Service to fetch tenant-specific credentials
 */
@Injectable()
export class PartnerServiceClient {
  private readonly logger = new Logger(PartnerServiceClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.baseUrl = this.configService.get<string>(
      'PARTNER_SERVICE_BASE_URL',
      'https://sandbox-apis.prayog.io'
    );
  }

  /**
   * Get tenant-specific partner credentials
   * @param tenantId Tenant ID
   * @param partnerId Partner ID (UUID)
   * @returns Array of partner credentials, or empty array if none found
   */
  async getTenantPartnerCredentials(
    tenantId: string,
    partnerId: string
  ): Promise<PartnerCredential[]> {
    try {
      const url = `${this.baseUrl}/partner/v1/tenant-partner-credentials/partner/${partnerId}/tenant/${tenantId}`;
      
      this.logger.debug(
        `Fetching tenant partner credentials for tenant: ${tenantId}, partnerId: ${partnerId}`
      );
      console.log("url", url);
      const response = await firstValueFrom(
        this.httpService.get<PartnerCredential[]>(url, {
          timeout: 5000, // 5 second timeout
        })
      );
      console.log("response", response.data);
      const credentials = response.data || [];
      
      if (credentials.length > 0) {
        this.logger.log(
          `Found ${credentials.length} tenant-specific credentials for tenant: ${tenantId}, partnerId: ${partnerId}`
        );
      } else {
        this.logger.debug(
          `No tenant-specific credentials found for tenant: ${tenantId}, partnerId: ${partnerId}`
        );
      }

      return credentials;
    } catch (error) {
      // Log warning but don't throw - will fallback to default credentials
      this.logger.debug(
        `Failed to fetch tenant partner credentials for tenant: ${tenantId}, partnerId: ${partnerId}. Error: ${error.message}. Will use default credentials.`
      );
      return [];
    }
  }
}

