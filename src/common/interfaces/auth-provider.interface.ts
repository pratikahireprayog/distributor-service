/**
 * Tenant context for passing tenant-specific information
 */
export interface TenantContext {
  tenantId?: string;
  userId?: string;
  partnerCredentials?: Array<{ key: string; value: string }>;
}

/**
 * Interface for authentication providers
 * Defines methods that must be implemented by all authentication providers
 */
export interface AuthProvider {
    /**
     * Gets authentication headers for API requests
     * @param tenantContext Optional tenant context for tenant-specific credentials
     * @returns A record of header key-value pairs
     */
    getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>>;
} 