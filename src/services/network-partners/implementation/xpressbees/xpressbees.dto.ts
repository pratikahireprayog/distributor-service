// Authentication DTOs
export class XpressbeesAuthRequestDto {
  email: string;
  password: string;
}

export class XpressbeesAuthResponseDto {
  status: boolean;
  data?: string; // Token is directly in data field as a string
}

// Product DTO
export class XpressbeesProductDto {
  product_name: string;
  product_qty: string;
  product_price: string;
  product_tax_per?: string;
  product_sku: string;
  product_hsn?: string;
}

// Invoice DTO
export class XpressbeesInvoiceDto {
  invoice_number: string;
  invoice_date: string;
  ebill_number?: string;
  ebill_expiry_date?: string;
}

// Create Order Request DTO
export class XpressbeesCreateOrderRequestDto {
  id: string;
  unique_order_number: string;
  payment_method: string;
  consigner_name: string;
  consigner_phone: string;
  consigner_pincode: string;
  consigner_city: string;
  consigner_state: string;
  consigner_address: string;
  consigner_gst_number?: string;
  consignee_name: string;
  consignee_phone: string;
  consignee_pincode: string;
  consignee_city: string;
  consignee_state: string;
  consignee_address: string;
  consignee_gst_number?: string;
  products: XpressbeesProductDto[];
  invoice: XpressbeesInvoiceDto[];
  weight: string;
  length: string;
  height: string;
  breadth: string;
  courier_id: string;
  pickup_location: string;
  shipping_charges?: string;
  cod_charges?: string;
  discount?: string;
  order_amount: string;
  collectable_amount: string;
}

// Create Order Response DTO
export class XpressbeesCreateOrderResponseDto {
  response?: boolean;
  status?: number;
  message?: string;
  shipping_id?: number;
  awb_number?: string;
  courier_id?: string;
  courier_name?: string;
  fwd_destination_code?: string;
  label?: string;
  // Also support nested structure for compatibility
  data?: {
    awb_number?: string;
    order_id?: string;
    tracking_number?: string;
    label_url?: string;
    label?: string;
  };
}

// Cancel Order Request DTO
export class XpressbessCancelOrderRequestDto {
  awb_number: string;
}

// Cancel Order Response DTO
export class XpressbessCancelOrderResponseDto {
  status: number;
  message: string;
  data?: any;
}

// Create Manifest Request DTO
export class XpressbeesCreateManifestRequestDto {
  awb_numbers: string;
}

// Create Manifest Response DTO
export class XpressbeesCreateManifestResponseDto {
  status: boolean;
  message: string;
  data?: any;
}
