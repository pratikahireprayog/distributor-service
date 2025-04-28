export interface NetworkPartnerRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  data?: any;
  params?: Record<string, string>;
}

export class NetworkPartnerRequestBuilder {
  private request: Partial<NetworkPartnerRequest> = {};

  constructor() {
    this.reset();
  }

  reset(): NetworkPartnerRequestBuilder {
    this.request = {
      headers: {},
      params: {},
    };
    return this;
  }

  setUrl(url: string): NetworkPartnerRequestBuilder {
    this.request.url = url;
    return this;
  }

  setMethod(method: string): NetworkPartnerRequestBuilder {
    this.request.method = method;
    return this;
  }

  setHeaders(headers: Record<string, string>): NetworkPartnerRequestBuilder {
    this.request.headers = { ...this.request.headers, ...headers };
    return this;
  }

  setData(data: any): NetworkPartnerRequestBuilder {
    this.request.data = data;
    return this;
  }

  setParams(params: Record<string, string>): NetworkPartnerRequestBuilder {
    this.request.params = { ...this.request.params, ...params };
    return this;
  }

  build(): NetworkPartnerRequest {
    if (!this.request.url) {
      throw new Error("URL is required to build a request");
    }

    if (!this.request.method) {
      throw new Error("Method is required to build a request");
    }

    return {
      url: this.request.url,
      method: this.request.method,
      headers: this.request.headers || {},
      data: this.request.data,
      params: this.request.params,
    } as NetworkPartnerRequest;
  }
}
