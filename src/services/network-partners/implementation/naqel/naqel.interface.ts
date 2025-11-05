export interface NaqelClientInfo {
  ClientID: number;
  Password: string;
  Version: string;
  ClientAddress: {
    PhoneNumber: string;
    NationalAddress: string;
    POBox: string;
    ZipCode: string;
    Fax: string;
    Latitude: string;
    Longitude: string;
    ShipperName: string;
    FirstAddress: string;
    Location: string;
    CountryCode: string;
    CityCode: string;
  };
  ClientContact: {
    Name: string;
    Email: string;
    PhoneNumber: string;
    MobileNo: string;
  };
}

export interface NaqelBookingShipmentDetail {
  ClientInfo: NaqelClientInfo;
  BillingType: number;
  PickUpReqDateTime: string;
  PicesCount: number;
  Weight: number;
  PickUpPoint: string;
  SpecialInstruction: string;
  OriginStationID: number;
  DestinationStationID: number;
  OfficeUpTo: string;
  ContactPerson: string;
  ContactNumber: string;
  LoadTypeID: number;
}

export interface NaqelWaybillDetail {
  ClientInfo: NaqelClientInfo;
  ConsigneeInfoAlt: {
    ConsigneeNationalID?: number;
    ConsigneePassportNo?: string;
    ConsigneePassportExp?: string;
    ConsigneeNationality?: string;
    ConsigneeNationalIdExpiry?: string;
    ConsigneeBirthDate?: string;
    ConsigneeName: string;
    Email?: string;
    Mobile: string;
    PhoneNumber?: string;
    Fax?: string;
    District?: string;
    What3Words?: string;
    SPLOfficeID?: string;
    consignee_serial?: string;
    BuildingNo?: string;
    ParcelLockerMachineID?: string;
    Address: string;
    NationalAddress: string;
    Near?: string;
    CountryName: string;
    ProvinceName: string;
    CityName: string;
  };
  _CommercialInvoice: {
    RefNo?: string;
    InvoiceNo: string;
    InvoiceDate: string;
    Consignee: string;
    ConsigneeAddress: string;
    ConsigneeEmail?: string;
    MobileNo: string;
    Phone?: string;
    TotalCost: number;
    CurrencyCode: string;
    CommercialInvoiceDetailList: {
      CommercialInvoiceDetail: Array<{
        Quantity: number;
        UnitType: string;
        CountryofManufacture: string;
        Description: string;
        ChineseDescription?: string;
        UnitCost: number;
        CustomsCommodityCode?: string;
        Currency: string;
        SKU?: string;
        CPC?: string;
        ItemWeightUnit?: number;
      }>;
    };
  };
  CurrenyID: number;
  BillingType: number;
  PicesCount: number;
  Weight: number;
  DeliveryInstruction?: string;
  CODCharge?: number;
  CreateBooking: boolean;
  isRTO: boolean;
  GeneratePiecesBarCodes: boolean;
  PromisedDeliveryDateFrom?: string;
  PromisedDeliveryDateTo?: string;
  LoadTypeID: number;
  DeclareValue?: number;
  GoodDesc: string;
  Incoterm?: string;
  IncotermsPlaceAndNotes?: string;
  Latitude?: string;
  Longitude?: string;
  RefNo?: string;
  Width?: number;
  Length?: number;
  Height?: number;
  InsuredValue?: number;
  Reference1?: string;
  Reference2?: string;
  GoodsVATAmount?: number;
  IsCustomDutyPayByConsignee: boolean;
  PickUpPoint?: string;
}