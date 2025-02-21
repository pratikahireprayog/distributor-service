import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomHttpException extends HttpException {
  private readonly trace: string;

  constructor(statusCode: HttpStatus, message: string, trace?: any) {
    super(message, statusCode);
    this.trace = trace;
  }

  get getTrace(): string {
    return this.trace;
  }
}
