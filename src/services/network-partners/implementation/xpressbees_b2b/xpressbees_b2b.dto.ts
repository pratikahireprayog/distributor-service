// Authentication DTOs
export class XpressbeesB2bAuthRequestDto {
  email: string;
  password: string;
}

export class XpressbeesB2bAuthResponseDto {
  status: boolean;
  data?: string; // Token is directly in data field as a string
}

// Product DTO
export class XpressbeesB2bProductDto {
  product_name: string;
  product_qty: string;
  product_price: string;
  product_tax_per: string;
  product_sku: string;
  product_hsn_code?: string;
  product_lbh_unit: string;
  product_length: number;
  product_breadth: number;
  product_height: number;
}

// Invoice DTO
export class XpressbeesB2bInvoiceDto {
  invoice_number: string;
  invoice_date: string;
  invoice_value: number;
  ebill_number?: string;
  ebill_expiry_date?: string;
}

// Create Order Request DTO
export class XpressbeesB2bCreateOrderRequestDto {
  id: string;
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
  products: XpressbeesB2bProductDto[];
  invoice: XpressbeesB2bInvoiceDto[];
  weight: number;
  courier_id: string;
  pickup_location: string;
  discount: number;
  order_amount: number;
  no_of_invoices: number;
  no_of_boxes: number;
  global_weight_unit: string;
}

// Create Order Response DTO
export class XpressbeesB2bCreateOrderResponseDto {
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
export class XpressbeesB2bCancelOrderRequestDto {
  awb_number: string;
}

// Cancel Order Response DTO
export class XpressbeesB2bCancelOrderResponseDto {
  status: number;
  message: string;
  data?: any;
}

// Create Manifest Request DTO
export class XpressbeesB2bCreateManifestRequestDto {
  awb_numbers: string;
}

// Create Manifest Response DTO
export class XpressbeesB2bCreateManifestResponseDto {
  status: boolean;
  message: string;
  data?: any;
}

