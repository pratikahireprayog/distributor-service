
const fedexBaseUrl = process.env.FEDEX_BASE_URL;

export const FEDEX_URLS = {
    AUTH_URL: `${fedexBaseUrl}/oauth/token`,
    CREATE_SHIPMENT: `${fedexBaseUrl}/ship/v1/shipments`,
    CANCEL_SHIPMENT: `${fedexBaseUrl}/ship/v1/shipments/cancel`,
    CREATE_PICKUP: `${fedexBaseUrl}/pickup/v1/pickups`,
    CANCEL_PICKUP: `${fedexBaseUrl}/pickup/v1/pickups/cancel`,
    CREATE_CONSOLIDATION: `${fedexBaseUrl}/ship/v1/consolidations`,
    CREATE_CONSOLIDATION_SHIPMENT: `${fedexBaseUrl}/ship/v1/consolidations/shipments`,
}

export const ACCOUNT_DETAILS = [
    {
        location: 'Mumbai',
        network: 'FEDEX (IMP)',
        accountNumber: 202947575
    },
    {
        location: 'Mumbai',
        network: 'FEDEX (ATD)',
        accountNumber: 202947576
    },
    {
        location: 'Mumbai',
        network: 'FEDEX (LWP)',
        accountNumber: 202947577
    },
    {
        location: 'Mumbai',
        network: 'FEDEX (GTI)',
        accountNumber: 202947578
    },

    {
        location: 'Ahmedabad',
        network: 'FEDEX (IMP)',
        accountNumber: 202946827
    },
    {
        location: 'Ahmedabad',
        network: 'FEDEX (ATD)',
        accountNumber: 202946829
    },
    {
        location: 'Ahmedabad',
        network: 'FEDEX (LWP)',
        accountNumber: 202946830
    },
    {
        location: 'Ahmedabad',
        network: 'FEDEX (GTI)',
        accountNumber: 202946831
    },

    {
        location: 'DELHI',
        network: 'FEDEX (IMP)',
        accountNumber: 202956822
    },
    {
        location: 'DELHI',
        network: 'FEDEX (ATD)',
        accountNumber: 202956820
    },
    {
        location: 'DELHI',
        network: 'FEDEX (LWP)',
        accountNumber: 202956824
    },
    {
        location: 'DELHI',
        network: 'FEDEX (GTI)',
        accountNumber: 202956821
    },
]

export const PACKAGING_TYPES = [
    "FEDEX_ENVELOPE",
    "FEDEX_SMALL_BOX",
    "FEDEX_MEDIUM_BOX",
    "FEDEX_LARGE_BOX",
    "FEDEX_EXTRA_LARGE_BOX",
    "FEDEX_PAK",
    "FEDEX_TUBE"
]

export const FEDEX_SERVICE_TYPE = [
    "STANDARD_OVERNIGHT",
    "YOUR_PACKAGING"
]