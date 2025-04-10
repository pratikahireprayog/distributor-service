import {
  BaseReqDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseResDto,
  BaseCancelOrderDto,
} from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";

/**
 * Interface defining the operations that can be performed by a network partner
 */
export interface INetworkPartner {
  createManifest<T extends BaseReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R>;

  createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R>;

  getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R>;

  cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  // cancelOrder(orderId: string): Promise<any>;
}
