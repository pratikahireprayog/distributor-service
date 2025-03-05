export enum TsawEndPoints {
    SHIPMENT_CREATE = '/shipment/create',
    SHIPMENT_CANCEL = '/shipment/cancel',
    TRACKING = '/shipment/track',
    RATE_CALCULATOR = '/rate/calculate',
    CARRIERS = '/carriers/list',
    ORDER_CREATE = '/order/create'
}

export enum ShipmentType {
    EXPRESS = 'EXPRESS',
    STANDARD = 'STANDARD',
    ECONOMY = 'ECONOMY'
}

export enum ServiceType {
    DOMESTIC = 'DOMESTIC',
    INTERNATIONAL = 'INTERNATIONAL'
}

export enum TsawOrderStatus {
    CREATED = 'CREATED',
    PICKED_UP = 'PICKED_UP',
    IN_TRANSIT = 'IN_TRANSIT',
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
    FAILED = 'FAILED'
} 