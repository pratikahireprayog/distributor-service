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
      'http://partner-service:3000'
    );
  }

  /**
   * Get tenant-specific partner credentials
   * @param tenantId Tenant ID
   * @param partnerCode Partner code
   * @returns Array of partner credentials, or empty array if none found
   */
  async getTenantPartnerCredentials(
    tenantId: string,
    partnerCode: string
  ): Promise<PartnerCredential[]> {
    try {
      const url = `${this.baseUrl}/api/v1/tenants/${tenantId}/partners/${partnerCode}/credentials`;
      
      this.logger.debug(
        `Fetching tenant partner credentials for tenant: ${tenantId}, partner: ${partnerCode}`
      );

      const response = await firstValueFrom(
        this.httpService.get<PartnerCredential[]>(url, {
          timeout: 5000, // 5 second timeout
        })
      );

      const credentials = response.data || [];
      
      if (credentials.length > 0) {
        this.logger.log(
          `Found ${credentials.length} tenant-specific credentials for tenant: ${tenantId}, partner: ${partnerCode}`
        );
      } else {
        this.logger.debug(
          `No tenant-specific credentials found for tenant: ${tenantId}, partner: ${partnerCode}`
        );
      }

      return credentials;
    } catch (error) {
      // Log warning but don't throw - will fallback to default credentials
      this.logger.debug(
        `Failed to fetch tenant partner credentials for tenant: ${tenantId}, partner: ${partnerCode}. Error: ${error.message}. Will use default credentials.`
      );
      return [];
    }
  }
}

