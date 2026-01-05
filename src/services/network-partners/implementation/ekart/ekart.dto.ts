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
  deliveryAppointmentDate?: string; // DD-MM-YYYY format
  deliveryTimeSlot?: string; // e.g., "16-20"
  deliveryType?: number; // e.g., 1
}

// Create Order Response DTO
export class EkartCreateOrderResponseDto {
  status?: boolean;
  message?: string;
  data?: {
    pickupPincode?: number;
    poNumber?: string;
    docketNo?: number;
    pickupRegistrationId?: number;
    docketPdfLink?: string;
    labelsLink?: string;
    startPktNo?: number;
    endPktNo?: number;
    awbNumber?: string;
    orderId?: string;
    trackingNumber?: string;
  };
  statusCode?: number;
  orderId?: string;
  trackingNumber?: string;
  awbNumber?: string;
  docketNo?: string;
}

// Cancel Order Request DTO
export class EkartCancelOrderRequestDto {
  remarks: string; // Hardcoded: "destination changed"
  reason: string; // Hardcoded: "CC"
  docketList: number[]; // Array of docket numbers
}

// Cancel Order Response DTO
export class EkartCancelOrderResponseDto {
  status?: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
}
