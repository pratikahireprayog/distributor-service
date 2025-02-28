/**
 * Interface for authentication providers
 * Defines methods that must be implemented by all authentication providers
 */
export interface AuthProvider {
    /**
     * Gets authentication headers for API requests
     * @returns A record of header key-value pairs
     */
    getAuthHeaders(): Promise<Record<string, string>>;
} 