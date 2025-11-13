// Authentication DTOs
export class EkartAuthRequestDto {
  userName: string;
  password: string;
}

export class EkartAuthResponseDto {
  data?: string; // Token is in data field
  status?: boolean;
  message?: string;
}

// Create Order Request DTOs
export class EkartLbhDataDto {
  packetCount: number;
  packetLength: string;
  packetWidth: string;
  packetHeight: string;
  packetNo?: string | null;
  customerPacketRefNo: string;
  actualWeight: string;
  invoiceNo?: string | null;
}

export class EkartInvoiceDetailsDto {
  invoiceNo: string;
  invoiceAmount: number;
  ewbNo?: string | null;
  invoiceDate: string; // Format: "DD-MM-YYYY"
  ewbDate?: string | null;
  ewbValidTill?: string | null;
}

export class EkartConsignorDto {
  consignorCode: string;
  consignorPincode: string;
  consignorName: string;
  address1: string;
  city: string;
  state: string;
  contactName: string;
  contactPhoneno: string;
  email: string;
}

export class EkartConsigneeDto {
  consigneeCode: string;
  consigneePincode: string;
  consigneeName: string;
  address1: string;
  city: string;
  state: string;
  contactName: string;
  contactPhoneno: string;
  email: string;
}

export class EkartCreateOrderRequestDto {
  poNumber: string;
  travelMode: string; // "Road" | "Air"
  grossWeight: number;
  packetCount: number;
  material?: string | null;
  lbhData: EkartLbhDataDto[];
  invoiceDetails: EkartInvoiceDetailsDto[];
  consignor: EkartConsignorDto;
  consignee: EkartConsigneeDto;
  docketNo?: string | null;
  packetLbhUom: string; // "in" | "cm"
  totalConsignmentValue: number;
  ftlOrPtl: string; // "1" | "0"
  openBoxPickup: number; // 0 | 1
  truckType?: string | null; // "20FT" | null
}

// Create Order Response DTO
export class EkartCreateOrderResponseDto {
  status?: boolean;
  message?: string;
  data?: any;
  orderId?: string;
  trackingNumber?: string;
  awbNumber?: string;
  docketNo?: string;
}

