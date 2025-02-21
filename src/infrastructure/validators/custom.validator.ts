/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  isEnum,
  isDefined,
} from 'class-validator';
import { CustomHttpException } from '../exception-handlers';
import { Reflector } from '@nestjs/core';
import { BadRequestException } from '@nestjs/common/exceptions';
import {
  createParamDecorator,
  ExecutionContext,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class EnumValidationPipe implements PipeTransform<string, any> {
  constructor(private enumType: any) {}

  transform(value: string): any {
    const enumValues = Object.values(this.enumType);
    const isValid = enumValues.includes(value);
    if (!isValid) {
      throw new BadRequestException(
        `Invalid value for provider. Expected one of: ${enumValues.join(', ')}`,
      );
    }
    return value;
  }
}

export function IsValidEnum(
  enumType: object,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidEnum',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [enumType],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const enumValues = Object.values(args.constraints[0]);
          return enumValues.includes(value);
        },
        defaultMessage(args: ValidationArguments) {
          const enumValues = Object.values(args.constraints[0]);
          return `${args.property} must be one of the following values: ${enumValues.join(', ')}`;
        },
      },
    });
  };
}

// Validator to check if a value is either a string or an array of strings
export function IsStringOrArrayOfStrings(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStringOrArrayOfStrings',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value === 'string') {
            return true;
          }
          if (
            Array.isArray(value) &&
            value.every((item) => typeof item === 'string')
          ) {
            return true;
          }
          return false;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a string or an array of strings`;
        },
      },
    });
  };
}
