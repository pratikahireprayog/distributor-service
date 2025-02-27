/**
 * Interface defining the operations that can be performed by a network partner
 */
export interface INetworkPartnerActivity {
    /**
     * Creates a shipment with the network partner
     * @param manifestationDetails The shipment data
     */
    createManifest(manifestationDetails: any): Promise<any>;

    /**
     * Tracks a shipment using the network partner's API
     * @param trackingId The tracking ID to track
     */
    // trackOrder(trackingId: string): Promise<any>;

    /**
     * Cancels a shipment with the network partner
     * @param shipmentId The shipment ID to cancel
     */
    // cancelOrder(orderId: string): Promise<any>;
}
