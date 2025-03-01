/**
 * Interface for partner API endpoints
 */
export interface PartnerEndpoint {
    /**
     * The URL of the endpoint
     */
    url: string;

    /**
     * The HTTP method to use
     */
    method: string;

    /**
     * Whether the endpoint requires authentication
     */
    requiresAuth: boolean;

    /**
     * The content type of the request (optional)
     */
    contentType?: string;
} 