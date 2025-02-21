import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export interface IDGenerationRQDto {
  idType: string;
}

export interface IDGenerationResDto {
  id: string;
  idType: string;
}

export class LoginApiPayload {
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @IsNotEmpty()
  @IsString()
  password: string;
  @IsNotEmpty()
  @IsString()
  vendorType: string;
}

export class LoginApiResponse {
  data: {
    accessToken: string;
    refreshToken: string;
  };
}
