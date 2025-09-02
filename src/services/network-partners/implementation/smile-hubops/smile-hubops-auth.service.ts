import { Injectable, Logger } from "@nestjs/common";
import { AuthProvider } from "src/common/interfaces/auth-provider.interface";

/**
 * Authentication service for SmileHubops partner
 * No authentication required - returns empty headers as no auth operation needed
 */
@Injectable()
export class SmileHubopsAuthService implements AuthProvider {
  private readonly logger = new Logger(SmileHubopsAuthService.name);

  constructor() {}

  /**
   * Get authentication headers for SmileHubops API requests
   * Returns empty headers as no authentication is required
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    this.logger.debug("No authentication required for SmileHubops");

    // Return empty headers - no auth operation needed
    return {};
  }
}
