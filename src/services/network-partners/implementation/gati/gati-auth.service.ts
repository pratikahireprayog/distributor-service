import { Injectable, Logger } from "@nestjs/common";
import { AuthProvider } from "../../interfaces/auth-provider.interface";

@Injectable()
export class GatiAuthService implements AuthProvider {
  private readonly logger = new Logger(GatiAuthService.name);

  constructor() {}

  /**
   * Get authentication headers for API requests
   * Implements the AuthProvider interface
   * @returns Headers for API requests including Cookie
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    // Note: JSESSIONID should be obtained from a session or config
    // For now, using a placeholder - this should be configured via environment variables
    const jsessionId = process.env.GATI_JSESSIONID || "7FAE9E4D36F177AAEC70745A49BCCCE9";
    
    return {
      "Content-Type": "application/json",
      Cookie: `JSESSIONID=${jsessionId}`,
    };
  }
}

