import { Injectable, Logger } from "@nestjs/common";
import { AuthProvider } from "../../interfaces/auth-provider.interface";

@Injectable()
export class MoverAuthService implements AuthProvider {
  private readonly logger = new Logger(MoverAuthService.name);

  // Hardcoded Basic Auth token for Mover API
  private readonly BASIC_AUTH_TOKEN = "cHJheW9nLWNsaWVudEBtb3Zlci5kZWxpdmVyeTpFeUdXREFpNmd1SnJhSGlM";

  constructor() {}

  /**
   * Get authentication headers for API requests
   * Implements the AuthProvider interface
   * Uses hardcoded Basic Auth token
   * @returns Headers for API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Basic ${this.BASIC_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    };
  }
}

