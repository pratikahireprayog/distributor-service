import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { catchError, firstValueFrom, from, map } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider } from 'src/services/network-partners/interfaces/auth-provider.interface';

interface LoginPayload {
    user_name: string;
    password: string;
    access_key: string;
}

interface TokenResponse {
    token: string;
    expiresIn?: number; // If the API provides expiration time
}

interface DecodedToken {
    nameid: string;
    unique_name: string;
    token_id: string;
    nbf: number;    // not before
    exp: number;    // expiration time
    iat: number;    // issued at
}

@Injectable()
export class BigshipAuthService implements AuthProvider {
export class BigshipAuthService implements AuthProvider {
    private token: string | null = null;
    private isTokenRefreshInProgress: Promise<string> | null = null;
    private readonly httpClient;

    constructor(
        private readonly jwtService: JwtService,
        private readonly logger: Logger,
    ) {
        // Initialize axios instance with default config
        this.httpClient = axios.create({
            timeout: 60000, // Set the timeout to 60 seconds (60000 ms)
            headers: {
                'Content-Type': 'application/json',
            }
        });
    }

    /**
     * Gets authentication headers for API requests
     * @returns A record of header key-value pairs
     */
    async getAuthHeaders(): Promise<Record<string, string>> {
        const token = await this.getToken();
        return {
            'Authorization': `Bearer ${token}`
        };
    }

    /**
     * Gets authentication headers for API requests
     * @returns A record of header key-value pairs
     */
    async getAuthHeaders(): Promise<Record<string, string>> {
        const token = await this.getToken();
        return {
            'Authorization': `Bearer ${token}`
        };
    }

    private getLoginPayload(): LoginPayload {
        const { USER_NAME, PASSWORD, ACCESS_KEY } = process.env;

        if (!USER_NAME || !PASSWORD || !ACCESS_KEY) {
            throw new Error('Missing required environment variables');
        }

        return {
            user_name: USER_NAME,
            password: PASSWORD,
            access_key: ACCESS_KEY
            access_key: ACCESS_KEY
        };
    }

    private async makeLoginRequest(payload: LoginPayload): Promise<TokenResponse> {
        const loginUrl = process.env.BIGSHIP_LOGIN_API;

        if (!loginUrl) {
            throw new Error('BIGSHIP_LOGIN_API environment variable is not set');
        }

        try {
            const observable$ = from(this.httpClient.post(loginUrl, payload)).pipe(
                map((response: any) => response.data),
                catchError((error: AxiosError) => {
                    const errorMessage = error.response?.data || error.message;
                    this.logger.error(`Login request failed: ${errorMessage}`);
                    throw new UnauthorizedException(errorMessage);
                })
            );

            const response = await firstValueFrom(observable$);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to obtain token: ${error.message}`);
            throw error;
        }
    }

    private isTokenExpired(token: string): boolean {
        try {
            const decoded = this.jwtService.decode(token) as DecodedToken;
            // Add a buffer of 5 minutes before expiry
            const bufferTime = 5 * 60; // 5 minutes in seconds
            const currentTime = Math.floor(Date.now() / 1000);

            this.logger.debug(`Token expiry time: ${new Date(decoded.exp * 1000)}`);
            this.logger.debug(`Current time: ${new Date(currentTime * 1000)}`);

            return currentTime + bufferTime >= decoded.exp;
        } catch (error) {
            this.logger.error(`Error decoding token: ${error.message}`);
            return true; // Consider invalid tokens as expired
        }
    }

    async getToken(): Promise<string> {
        try {
            // If a token refresh is already in progress, wait for it
            if (this.isTokenRefreshInProgress) {
                this.logger.debug('Token refresh already in progress, waiting...');
                return await this.isTokenRefreshInProgress;
            }

            // If token exists, check if it's still valid
            if (this.token) {
                const isExpired = this.isTokenExpired(this.token);
                if (!isExpired) {
                    this.logger.debug('Using existing valid token');
                    return this.token;
                }
                this.logger.debug('Token is expired, requesting new token');
            }

            // Get new token
            this.isTokenRefreshInProgress = (async () => {
                try {
                    const payload = this.getLoginPayload();
                    const response = await this.makeLoginRequest(payload);
                    this.token = response.token;

                    // Log new token details
                    const decoded = this.jwtService.decode(this.token) as DecodedToken;
                    this.logger.debug(`New token obtained, expires at: ${new Date(decoded.exp * 1000)}`);

                    return this.token;
                } finally {
                    this.isTokenRefreshInProgress = null;
                }
            })();

            return await this.isTokenRefreshInProgress;
        } catch (error) {
            this.logger.error(`Token retrieval failed: ${error.message}`);
            throw error;
        }
    }
}