import { HttpException, HttpStatus } from "@nestjs/common";

export class CustomHttpException extends HttpException {
  private readonly errorData: any;
  private readonly traceData: any;
  private readonly partnerCode: string;

  constructor(
    statusCode: HttpStatus,
    message: string,
    data?: any,
    trace?: any,
    partnerCode?: string
  ) {
    super({ message, statusCode, data, trace, partnerCode }, statusCode);
    this.errorData = data;
    this.traceData = trace;
    this.partnerCode = partnerCode;
  }

  get getData(): any {
    return this.errorData;
  }

  get getTrace(): any {
    return this.traceData;
  }

  get getPartnerCode(): string {
    return this.partnerCode;
  }
}
