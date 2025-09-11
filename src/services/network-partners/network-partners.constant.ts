export const NETWORK_PARTNER_PROVIDER_CONST = {
    BIGSHIP: 'NETWORK_PARTNER.BIGSHIP',
    TSAW: 'NETWORK_PARTNER.TSAW',
    SHIPYAARI: 'NETWORK_PARTNER.SHIPYAARI',
    DHL: 'NETWORK_PARTNER.DHL',
    UNIUNI: 'NETWORK_PARTNER.UNIUNI',
    DEFAULT: 'NETWORK_PARTNER.DEFAULT',
    FACTORY_INIT: 'NETWORK_PARTNER.FACTORY_INIT',
    SMILE_HYPERLOCAL: 'NETWORK_PARTNER.SMILE_HYPERLOCAL',
    PORTER: 'NETWORK_PARTNER.PORTER',
    SMILE_HUBOPS: "NETWORK_PARTNER.SMILE_HUBOPS",
    ARAMEX: 'NETWORK_PARTNER.ARAMEX'
} as const;

// Test User
export const ARAMEX_CLIENT_INFO = {
    USERNAME: "test.api@aramex.com",
    PASSWORD: "Aramex@12345",
    VERSION: "v1.0",
    ACCOUNT_NUMBER: "60531487",
    ACCOUNT_PIN: "654654",
    ACCOUNT_ENTITY: "BOM",
    ACCOUNT_COUNTRY_CODE: "IN",
    SOURCE: 24,
}

export const ARAMEX_ACCOUNTS = {
    DELHI: {
        AccountNumber: "60501059",
        AccountPin: "332432",
        AccountEntity: "DELHI",
        AccountCountryCode: "IN",
    },
    BLR: {
        AccountNumber: "60538350",
        AccountPin: "116216",
        AccountEntity: "BLR",
        AccountCountryCode: "IN",
    },
    HYD: {
        AccountNumber: "60520827",
        AccountPin: "554654",
        AccountEntity: "HYD",
        AccountCountryCode: "IN",
    },
    BOM: {
        AccountNumber: "BOM6661056",
        AccountPin: "543643",
        AccountEntity: "BOM",
        AccountCountryCode: "IN",
    },
    AMD: {
        AccountNumber: "BOM6661056",
        AccountPin: "543643",
        AccountEntity: "AMD",
        AccountCountryCode: "IN",
    },
    CHENNAI: {
        AccountNumber: "60520426",
        AccountPin: "432432",
        AccountEntity: "CHENNAI",
        AccountCountryCode: "IN",
    },
};


export const ORDER_TYPE = {
    FORWARD: "FORWARD",
    EXP: "EXP",
    DOM: "DOM"
}