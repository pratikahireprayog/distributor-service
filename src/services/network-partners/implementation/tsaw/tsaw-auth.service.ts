import { Injectable, Logger } from '@nestjs/common';
import { AuthProvider, TenantContext } from 'src/services/network-partners/interfaces/auth-provider.interface';

@Injectable()
export class TsawAuthService implements AuthProvider {
    constructor(private readonly logger: Logger) { }

    async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
        const accessToken = process.env.TSAW_ACCESS_TOKEN;

        if (!accessToken) {
            this.logger.error('TSAW_ACCESS_TOKEN environment variable is not set');
            throw new Error('TSAW_ACCESS_TOKEN environment variable is not set');
        }

        return {
            'x-access-token': accessToken
        };
    }
} 