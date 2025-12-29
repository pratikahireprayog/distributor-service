import { Injectable } from "@nestjs/common";
import { AuthProvider, TenantContext } from "../../interfaces/auth-provider.interface";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PorterAuthService implements AuthProvider {
  constructor(private readonly configService: ConfigService) {}

  async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
    const apiKey = this.configService.get<string>('PORTER_API_KEY');
    
    if (!apiKey) {
      throw new Error('PORTER_API_KEY environment variable is not configured');
    }

    return {
      "x-api-key": apiKey,
      "Content-Type": "application/json"
    };
  }
}
