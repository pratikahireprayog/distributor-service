import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { SHIPCUBEAuthService } from "./shipcube-auth.service";
import { CustomHttpException } from "src/infrastructure/exception-handlers";
import { BaseCancelOrderDtoV2, BaseOrderReqDtoV2 } from "src/common/dtos/base2.dto";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories";
import { SchemaMapperService } from "src/infrastructure/schema-mapper";
import * as https from "https";
import { BaseNetworkPartner } from "../../base/base-network-partner.abstract";
import { BaseResDto } from "src/common/dtos/base.dto";
import * as bwipjs from 'bwip-js';
import * as path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import * as fs from 'fs';
@Injectable()
export class SHIPCUBEService extends BaseNetworkPartner {
  protected readonly logger = new Logger(SHIPCUBEService.name);
  private readonly httpsAgent: https.Agent;

  constructor(
    protected readonly httpService: HttpService,
    private readonly configService: ConfigService,
    protected readonly authProvider: SHIPCUBEAuthService,
    protected readonly endpointConfigRepository: EndpointConfigRepository,
    protected readonly schemaMapper: SchemaMapperService<any, any>
  ) {
    super(PARTNER_CODE_ENUM.SHIPCUBE, null, httpService, endpointConfigRepository, schemaMapper);

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      timeout: 60000,
    });
  }

  async createProduct(data: any): Promise<any> {
    const mutation = `
      mutation product_create($data: ProductInput!) {
        product_create(data: $data) {
          request_id
          complexity
          product {
            id
            sku
            name
            warehouse_products {
              id
              warehouse_id
              on_hand
            }
          }
        }
      }
    `;

    const variables = { data };
    return this.executeGraphQL(mutation, variables, "Create Product");
  }

  private async fetchSkuByItemId(
    graphqlUrl: string,
    token: string,
    itemName: string
  ): Promise<string | null> {
    const productQuery = `
      query ($name: String!) {
        products(name: $name, first: 1) {
          edges {
            node {
              id
              sku
              name
            }
          }
        }
      }
    `;

    const response = await firstValueFrom(
      this.httpService.post(
        graphqlUrl,
        { query: productQuery, variables: { name: itemName } },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )
    );

    const product =
      response.data?.data?.products?.edges?.[0]?.node || null;

    return product?.sku || null;
  }

  async getProductBySku(sku: string): Promise<any> {
    const query = `
      query warehouse_products($sku: String!) {
        warehouse_products(sku: $sku) {
          data {
            edges {
              node {
                sku
                available
                on_hand
                allocated
                warehouse {
                  id
                  identifier
                  address {
                    name
                    country
                    state
                    city
                  }
                }
              }
            }
          }
        }
      }
    `;
    return this.executeGraphQL(query, { sku }, "Get Product");
  }

  async getWarehouses(): Promise<any> {
    const query = `
      query {
        account(analyze: false) {
          request_id
          data {
            warehouses {
              id
              identifier
              address {
                name
                country
                state
                city
              }
            }
          }
        }
      }
    `;
    return this.executeGraphQL(query, {}, "Get Warehouses");
  }


  async createOrderV2<T extends BaseOrderReqDtoV2, R extends any>(
    orderDetails: any,
  ): Promise<R> {

    const mutationPayloadVariables = await this.mapToShipCubeMutation(orderDetails);
    const mutation = `
      mutation order_create($data: CreateOrderInput!) {
        order_create(data: $data) {
          request_id
          complexity
          order {
            id
            order_number
            line_items(first: 10) {
              edges {
                node {
                  id
                  sku
                  quantity
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      data: {
        shop_name: orderDetails.shopName || "ServiceabilityTest",
        order_number: orderDetails.orderNumber || `TEST-${Date.now()}`,
        shipping_address: orderDetails.shippingAddress,
        line_items: orderDetails.lineItems,
      },
    };

    const response = await this.executeGraphQL(mutation, mutationPayloadVariables, "Create Order");
    const orderData = response?.data?.order_create?.order;;
    const orderNumber = orderData.order_number;
    const barcodeLabels = [];
    for (const edge of orderData?.line_items?.edges) { 
      const sku = edge?.node?.sku;
      const barcodeLabel = await this.generateLabel(orderNumber, sku);
      barcodeLabels.push({
        order_id: orderData.id,
        order_number:  orderNumber,
        product_sku: sku,
        barcode_label: barcodeLabel,
      });

    }
    response.barcodeLabels = barcodeLabels;
    return response
  }

  async cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
  ): Promise<R> {

    const graphqlUrl = this.configService.get<string>("SHIPCUBE_URL");
    const awbNumber = data.cAwbNumbers?.[0] || '';
    const token = await this.authProvider.getToken();

    const cancelMutation = `
      mutation order_cancel($data: CancelOrderInput!) {
        order_cancel(data: $data) {
          request_id
          complexity
          order {
            id
            order_number
            fulfillment_status
          }
        }
      }
    `;

    const response = await firstValueFrom(
      this.httpService.post(
        graphqlUrl,
        {
          query: cancelMutation,
          variables: { data: { order_id: awbNumber } },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )
    );

    return response.data;
  }


  async mapToShipCubeMutation(orderDetails) {

    const token = await this.authProvider.getToken();
    const graphqlUrl = this.configService.get<string>("SHIPCUBE_URL");
    const warehouseId = await this.getWarehouseId(graphqlUrl, token);
    // Find delivery address
    const deliveryAddress = orderDetails.addresses.find((addr: any) => addr.type === "DELIVERY");
    // Map line items
    const lineItems = orderDetails.parentShipment.items.map((item: any) => ({
      partner_line_item_id: item.id.toString(),
      sku: item.sku ? item.sku : this.fetchSkuByItemId(graphqlUrl, token, item.name),
      quantity: item.quantity,
      price: item.unitPrice,
      warehouse_id: warehouseId,
    }));

    return {
      data: {
        shop_name: "ServiceabilityTest",
        order_number: orderDetails.orderId,
        shipping_address: deliveryAddress
          ? {
            first_name: deliveryAddress.name,
            last_name: "",
            address1: deliveryAddress.street,
            city: deliveryAddress.city,
            state: deliveryAddress.state,
            zip: deliveryAddress.zip,
            country: deliveryAddress.country === "India" ? "IN" : deliveryAddress.country,
            phone: deliveryAddress.phone,
            email: deliveryAddress.email || "",
          }
          : {},
        line_items: lineItems,
      }
    };
  }

  private async executeGraphQL(
    query: string,
    variables: Record<string, any>,
    operationName: string
  ): Promise<any> {
    try {
      const token = await this.authProvider.getToken();
      const graphqlUrl = this.configService.get<string>("SHIPCUBE_URL");

      const response = await firstValueFrom(
        this.httpService.post(
          graphqlUrl,
          { query, variables },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        )
      );

      if (response.data.errors) {
        this.logger.error(
          `${operationName} failed: ${JSON.stringify(response.data.errors)}`
        );
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          response.data.errors[0].message
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error(
        `${operationName} failed: ${error.message}`,
        error.stack
      );
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `${operationName} failed: ${error.message}`
      );
    }
  }

  private async getWarehouseId(graphqlUrl: string, token: string): Promise<string> {
    const warehouseQuery = `
      query {
        account(analyze: false) {
          request_id
          complexity
          data {
            warehouses {
              id
              identifier
              address {
                name
                country
                state
                city
                zip
              }
            }
          }
        }
      }
    `;

    const response = await firstValueFrom(
      this.httpService.post(
        graphqlUrl,
        { query: warehouseQuery },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )
    );

    const warehouses =
      response.data?.data?.account?.data?.warehouses || [];

    // Pick the first valid warehouse with address
    const validWarehouse = warehouses.find(
      (w: any) =>
        w.address?.country &&
        w.address?.state &&
        w.address?.city &&
        w.address?.zip
    );

    if (!validWarehouse) {
      this.logger.warn("No valid warehouse found in ShipHero account query.");
      throw new Error("No valid warehouse found.");
    }

    return validWarehouse.id;
  }

  private async generateLabel(orderId: string, productSku: string): Promise<string> {
  try {
    const LABEL_WIDTH = 825;
    const LABEL_HEIGHT = 350;

    const canvas = createCanvas(LABEL_WIDTH, LABEL_HEIGHT);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

    // Generate barcode
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: orderId,
      scale: 3,
      height: 15,
      includetext: false,
    });

    const barcodeImg = await loadImage(barcodeBuffer);
    
    // Calculate dimensions similar to Python code
    const maxBarcodeHeight = LABEL_HEIGHT - 140;
    let barcodeWidth = barcodeImg.width;
    let barcodeHeight = barcodeImg.height;
    
    // Scale barcode if too tall
    if (barcodeHeight > maxBarcodeHeight) {
      const scale = maxBarcodeHeight / barcodeHeight;
      barcodeWidth = barcodeWidth * scale;
      barcodeHeight = maxBarcodeHeight;
    }

    // Center barcode horizontally
    const barcodeX = (LABEL_WIDTH - barcodeWidth) / 2;
    const barcodeY = 40;

    // Draw scaled barcode
    ctx.drawImage(barcodeImg, barcodeX, barcodeY, barcodeWidth, barcodeHeight);

    // Set up fonts
    ctx.fillStyle = '#000000';
    
    // Measure text - similar to Python's textbbox
    ctx.font = '40px Arial';
    const orderTextMetrics = ctx.measureText(orderId);
    const orderTextWidth = orderTextMetrics.width;
    const orderTextHeight = 40; // Approximate height for Arial 40px

    ctx.font = '40px Arial';
    const skuTextMetrics = ctx.measureText(productSku);
    const skuTextWidth = skuTextMetrics.width;
    const skuTextHeight = 40;

    ctx.font = '15px Arial';
    const poweredByText = 'Powered by';
    const poweredMetrics = ctx.measureText(poweredByText);
    const poweredWidth = poweredMetrics.width;
    const poweredHeight = 15;

    // Calculate positions with gaps
    const gap = 5;
    const blockHeight = barcodeHeight + gap + orderTextHeight + gap + skuTextHeight + gap + poweredHeight;
    const topPadding = (LABEL_HEIGHT - blockHeight) / 2;

    // Adjust barcode position based on calculated padding
    const adjustedBarcodeY = topPadding;
    ctx.drawImage(barcodeImg, barcodeX, adjustedBarcodeY, barcodeWidth, barcodeHeight);

    // Draw order ID text (centered)
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    const orderTextX = LABEL_WIDTH / 2;
    const orderTextY = adjustedBarcodeY + barcodeHeight + gap + orderTextHeight;
    ctx.fillText(orderId, orderTextX, orderTextY);

    // Draw SKU text (centered)
    const skuTextX = LABEL_WIDTH / 2;
    const skuTextY = orderTextY + gap + skuTextHeight;
    ctx.fillText(productSku, skuTextX, skuTextY);

    // Draw footer with logo (right aligned)
    ctx.font = '15px Arial';
    ctx.textAlign = 'left';
    
    const logoWidth = 100;
    const logoGap = 10;
    
    // Calculate footer position
    const totalFooterWidth = poweredWidth + logoGap + logoWidth;
    const footerX = LABEL_WIDTH - totalFooterWidth - 20; // Right padding
    const footerY = skuTextY + gap + poweredHeight;

    // Draw "Powered by"
    ctx.fillText(poweredByText, footerX, footerY);

    // Add logo
    try {
      let logoPath = path.join(process.cwd(), 'src', 'assets', 'smileLogo.png');      
      if (fs.existsSync(logoPath)) {
        const logoImg = await loadImage(logoPath);
        const logoAspectRatio = logoImg.height / logoImg.width;
        const logoHeight = logoWidth * logoAspectRatio;
        
        const logoX = footerX + poweredWidth + logoGap;
        const logoY = footerY - logoHeight + 5; // Adjust alignment
        
        ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
      }
    } catch (logoError) {
      this.logger.warn('Logo not available');
    }

    const buffer = canvas.toBuffer('image/png');
    return `data:image/png;base64,${buffer.toString('base64')}`;

  } catch (error) {
    this.logger.error(`Label generation failed: ${error.message}`);
    throw error;
  }
}

}
