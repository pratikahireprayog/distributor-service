/**
 * DPWORLD API Request DTOs
 */

/**
 * Form data item for DPWORLD shipment creation
 * Required fields: awbNumber
 * Conditionally required: productNumber (only when product data is provided)
 */
export interface DpworldFormDataItem {
  awbNumber: string; // Required
  shipper?: string;
  consignee?: string;
  shipmentTags?: string;
  partnerOrgNumbers?: string;
  poNumber?: string;
  order_date?: string;
  invoice_number?: string;
  productNumber?: string; // Required only when product data is provided
  productDescription?: string;
  hsCode?: string;
  productQuantity?: number;
  quantityUom?: string;
  unitPrice?: number;
  priceCurrency?: string;
  lotNumber?: string;
  productionDate?: string;
  expirationDate?: string;
}

/**
 * DPWORLD create shipment request DTO
 * Required fields: formData, uploadType
 */
export interface DpworldCreateShipmentRequestDto {
  formData: DpworldFormDataItem[]; // Required
  uploadType: string; // Required
}

/**
 * DPWORLD API Response DTOs
 */

/**
 * DPWORLD create shipment response DTO
 */
export interface DpworldCreateShipmentResponseDto {
  success?: boolean;
  message?: string;
  data?: any;
  statusCode?: number;
  error?: any;
}

