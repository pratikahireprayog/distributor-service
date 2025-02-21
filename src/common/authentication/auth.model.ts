import { AUTH_TYPE } from './auth.constant';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class JwtPayload {
  _id?: string;
  @IsNotEmpty()
  @IsString()
  authType: AUTH_TYPE;
  @IsOptional()
  @IsEmail()
  email?: string;
  @IsOptional()
  @IsString()
  vendorCode?: string;
  @IsOptional()
  @IsString()
  mobile?: string;
}
