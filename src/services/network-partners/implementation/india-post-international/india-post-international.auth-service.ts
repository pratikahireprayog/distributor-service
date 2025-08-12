import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AuthProvider } from "../../interfaces/auth-provider.interface";

@Injectable()
export class IndiaPostInternationalAuthService implements AuthProvider {
  private readonly logger = new Logger(IndiaPostInternationalAuthService.name);

  private cachedAccessToken: string | null = null;
  private cachedRefreshToken: string | null = null;
  private tokenExpiresAtMs: number | null = null;
  private refreshInFlight: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {}

  /**
   * Get authentication headers for India Post International API
   * Typically uses API key authentication
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // If a static bearer token is provided via env, use it and skip login
    const staticToken = this.configService.get<string>(
      "INDIA_POST_BEARER_TOKEN"
    );
    if (staticToken && staticToken.trim().length > 0) {
      headers["Authorization"] = `Bearer ${staticToken.trim()}`;
      return headers;
    }

    const skipAuth = `${
      this.configService.get<string>("INDIA_POST_SKIP_AUTH") || "false"
    }`
      .toLowerCase()
      .trim() === "true";

    if (skipAuth) {
      this.logger.warn(
        "INDIA_POST_SKIP_AUTH is enabled. Authorization header will be omitted."
      );
      return headers;
    }

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

    if (this.refreshInFlight) {
      this.logger.debug("Auth refresh already in flight. Awaiting...");
      return this.refreshInFlight;
    }

    this.refreshInFlight = (async () => {
      try {
        // Use refresh token flow if we have both refresh token and configured endpoint
        const refreshUrl = this.configService.get<string>(
          "INDIA_POST_REFRESH_URL"
        );
        if (this.cachedRefreshToken && refreshUrl) {
          try {
            await this.refreshAccessToken(refreshUrl, this.cachedRefreshToken);
            return this.cachedAccessToken as string;
          } catch (e) {
            this.logger.warn(
              `Refresh token failed, falling back to login: ${(e as Error).message}`
            );
          }
        }

        // Otherwise do a login to obtain a new token
        await this.loginAndCacheTokens();
        return this.cachedAccessToken as string;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  private async loginAndCacheTokens(): Promise<void> {
    const loginUrl =
      this.configService.get<string>("INDIA_POST_LOGIN_URL") ||
      this.configService.get<string>("INDIA_POST_TOKEN_URL");

    if (!loginUrl) {
      throw new Error(
        "India Post login/token URL is not configured. Set INDIA_POST_LOGIN_URL or INDIA_POST_TOKEN_URL"
      );
    }

    // Prefer explicit CommonLogin (3 parameters) when creds exist
    const username = this.configService.get<string>("INDIA_POST_USERNAME");
    const password = this.configService.get<string>("INDIA_POST_PASSWORD");
    const realm =
      this.configService.get<string>("INDIA_POST_REALM") || "customer-portal";

    let responseData: any;
    if (username && password) {
      // CommonLogin path (JSON with 3 parameters)
      const payload = {
        username,
        realm,
        Password: password, // per CEPT doc, key name is capital-P
      } as Record<string, any>;

      const resp = await firstValueFrom(
        this.httpService.post(loginUrl, payload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        })
      );
      responseData = resp.data;
    } else {
      // Fallback: Keycloak token endpoint convention
      const form = new URLSearchParams();
      const clientId =
        this.configService.get<string>("INDIA_POST_CLIENT_ID") || "public";
      const grantType =
        this.configService.get<string>("INDIA_POST_GRANT_TYPE") ||
        "password";

      if (username) form.append("username", username);
      if (password) form.append("password", password);
      form.append("grant_type", grantType);
      form.append("client_id", clientId);

      const resp = await firstValueFrom(
        this.httpService.post(loginUrl, form.toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );
      responseData = resp.data;
    }

    const { accessToken, refreshToken, expiresAtMs } = this.extractTokens(
      responseData
    );
    if (!accessToken) {
      this.logger.error(
        `Failed to extract access token from response: ${JSON.stringify(
          responseData
        )}`
      );
      throw new Error("India Post authentication failed: token not found");
    }

    this.cachedAccessToken = accessToken;
    this.cachedRefreshToken = refreshToken || null;
    // Default to 20 minutes if no expiry provided
    this.tokenExpiresAtMs = expiresAtMs || Date.now() + 20 * 60 * 1000;
    this.logger.debug(
      `Obtained India Post token. Expires at: ${new Date(
        this.tokenExpiresAtMs
      ).toISOString()}`
    );
  }

  private async refreshAccessToken(
    refreshUrl: string,
    refreshToken: string
  ): Promise<void> {
    // Support both JSON and x-www-form-urlencoded styles
    const isForm = /keycloak\/refreshtoken/i.test(refreshUrl);
    let responseData: any;
    if (isForm) {
      const form = new URLSearchParams();
      form.append("grant_type", "refresh_token");
      form.append("refresh_token", refreshToken);
      const clientId =
        this.configService.get<string>("INDIA_POST_CLIENT_ID") || "public";
      form.append("client_id", clientId);
      const resp = await firstValueFrom(
        this.httpService.post(refreshUrl, form.toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );
      responseData = resp.data;
    } else {
      const resp = await firstValueFrom(
        this.httpService.get(refreshUrl, {
          headers: { Authorization: `Bearer ${this.cachedAccessToken || ""}` },
          params: { refresh_token: refreshToken },
        })
      );
      responseData = resp.data;
    }

    const { accessToken, refreshToken: newRefresh, expiresAtMs } =
      this.extractTokens(responseData);
    if (!accessToken) throw new Error("Refresh did not return access token");
    this.cachedAccessToken = accessToken;
    this.cachedRefreshToken = newRefresh || this.cachedRefreshToken;
    this.tokenExpiresAtMs = expiresAtMs || Date.now() + 20 * 60 * 1000;
  }

  private extractTokens(data: any): {
    accessToken: string | null;
    refreshToken?: string | null;
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

    let refreshToken =
      data?.refresh_token ||
      data?.data?.refresh_token ||
      data?.result?.refresh_token ||
      null;

    // If still not found, deep-search for likely token fields
    const deepFind = (obj: any): { access?: string; refresh?: string; expiresIn?: number } => {
      const stack: any[] = [obj];
      const found: { access?: string; refresh?: string; expiresIn?: number } = {};
      while (stack.length) {
        const cur = stack.pop();
        if (cur && typeof cur === "object") {
          for (const [k, v] of Object.entries(cur)) {
            if (typeof v === "object" && v !== null) stack.push(v);
            if (!found.access && typeof v === "string") {
              if (k.toLowerCase().includes("access") || k.toLowerCase() === "token" || k.toLowerCase().includes("jwt")) {
                found.access = v;
              }
            }
            if (!found.refresh && typeof v === "string") {
              if (k.toLowerCase().includes("refresh")) found.refresh = v;
            }
            if (!found.expiresIn && (typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v)))) {
              if (k.toLowerCase().includes("expires_in")) found.expiresIn = Number(v);
            }
          }
        }
      }
      return found;
    };

    if (!accessToken) {
      const found = deepFind(data);
      accessToken = found.access || null;
      refreshToken = refreshToken || found.refresh || null;
      const expiresInSec =
        data?.expires_in || data?.data?.expires_in || data?.result?.expires_in || found.expiresIn;
      const expiresAtMs = expiresInSec ? Date.now() + Number(expiresInSec) * 1000 : null;
      return { accessToken, refreshToken, expiresAtMs };
    }

    const expiresInSec =
      data?.expires_in || data?.data?.expires_in || data?.result?.expires_in;
    const expiresAtMs = expiresInSec ? Date.now() + Number(expiresInSec) * 1000 : null;
    return { accessToken, refreshToken, expiresAtMs };
  }
}


