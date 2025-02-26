/**
 * Interface defining the operations that can be performed by a network partner
 */
export interface INetworkPartnerActivity {
    /**
     * Creates a shipment with the network partner
     * @param data The shipment data
     */
    createShipment(data: any): Promise<any>;

    /**
     * Tracks a shipment using the network partner's API
     * @param trackingId The tracking ID to track
     */
    trackShipment(trackingId: string): Promise<any>;

    /**
     * Cancels a shipment with the network partner
     * @param shipmentId The shipment ID to cancel
     */
    cancelShipment(shipmentId: string): Promise<any>;
}
