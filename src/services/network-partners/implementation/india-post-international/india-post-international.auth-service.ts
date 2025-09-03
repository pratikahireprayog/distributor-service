import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AuthProvider } from "../../interfaces/auth-provider.interface";

@Injectable()
export class IndiaPostInternationalAuthService implements AuthProvider {
  private readonly logger = new Logger(IndiaPostInternationalAuthService.name);

  private cachedAccessToken: string | null = null;
  private tokenExpiresAtMs: number | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {}

  /**
   * Get authentication headers for India Post International API
   * Supports static bearer token, skip auth, or OAuth login
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    // If a static bearer token is provided via env, use it and skip login
    const staticToken = this.configService.get<string>('INDIA_POST_BEARER_TOKEN');
    if (staticToken && staticToken.trim().length > 0) {
      headers["Authorization"] = `Bearer ${staticToken.trim()}`;
      return headers;
    }

    const skipAuth = `${this.configService.get<string>('INDIA_POST_SKIP_AUTH')}`.toLowerCase() === 'true';
    
    if (skipAuth) {
      this.logger.warn('INDIA_POST_SKIP_AUTH is enabled. Authorization header will be omitted.');
      return headers;
    }

    // Use OAuth login to get token
    const token = await this.getToken();
    headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  private isTokenValid(): boolean {
    if (!this.cachedAccessToken || !this.tokenExpiresAtMs) return false;
    const now = Date.now();
    // Renew a bit early (buffer 60 seconds)
    return now + 60_000 < this.tokenExpiresAtMs;
  }

  private async getToken(): Promise<string> {
    if (this.isTokenValid()) return this.cachedAccessToken as string;

    // Do a login to obtain a new token
    await this.loginAndCacheTokens();
    return this.cachedAccessToken as string;
  }

  private async loginAndCacheTokens(): Promise<void> {
    const loginUrl = this.configService.get<string>("INDIA_POST_LOGIN_URL");

    if (!loginUrl) {
      throw new Error(
        "India Post login URL is not configured. Set INDIA_POST_LOGIN_URL"
      );
    }

    const username = this.configService.get<string>("INDIA_POST_USERNAME");
    const password = this.configService.get<string>("INDIA_POST_PASSWORD");
    const realm = this.configService.get<string>("INDIA_POST_REALM") || "customer-portal";

    if (!username || !password) {
      throw new Error(
        "India Post username/password not configured. Set INDIA_POST_USERNAME and INDIA_POST_PASSWORD"
      );
    }

    // CommonLogin path (JSON with 3 parameters)
    const payload = {
      username,
      realm,
      Password: password, // per CEPT doc, key name is capital-P
    };

    const resp = await firstValueFrom(
      this.httpService.post(loginUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      })
    );

    const responseData = resp.data;
    const { accessToken, expiresAtMs } = this.extractTokens(responseData);
    
    if (!accessToken) {
      this.logger.error(
        `Failed to extract access token from response: ${JSON.stringify(responseData)}`
      );
      throw new Error("India Post authentication failed: token not found");
    }

    this.cachedAccessToken = accessToken;
    // Default to 20 minutes if no expiry provided
    this.tokenExpiresAtMs = expiresAtMs || Date.now() + 20 * 60 * 1000;
    
    this.logger.debug(
      `Obtained India Post token. Expires at: ${new Date(this.tokenExpiresAtMs).toISOString()}`
    );
  }

  private extractTokens(data: any): {
    accessToken: string | null;
    expiresAtMs?: number | null;
  } {
    // Try common shapes first
    let accessToken =
      data?.access_token ||
      data?.token ||
      data?.jwt ||
      data?.data?.access_token ||
      data?.data?.token ||
      data?.data?.jwt ||
      data?.result?.access_token ||
      data?.result?.token ||
      data?.result?.jwt ||
      null;

    const expiresInSec = data?.expires_in || data?.data?.expires_in || data?.result?.expires_in;
    const expiresAtMs = expiresInSec ? Date.now() + Number(expiresInSec) * 1000 : null;
    
    return { accessToken, expiresAtMs };
  }
}


