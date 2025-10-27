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
// Note: Optional heavy deps (bwip-js, canvas) removed to avoid build-time issues
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
    // Stubbed label generation to avoid optional dependency failures.
    // Return empty string or a simple placeholder if needed.
    return '';
  }

}
