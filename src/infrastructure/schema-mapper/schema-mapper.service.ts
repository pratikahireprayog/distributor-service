import { Injectable } from '@nestjs/common';
import { ISchemaMapper } from './schema-mapper.interface';
import { MappingConfig } from './schema-mapper.config.interface';

@Injectable()
export class SchemaMapperService<TSource, TTarget>
  implements ISchemaMapper<TSource, TTarget>
{
  constructor() {}

  map(sourceData: any, mappingConfig: MappingConfig): any {
    const destinationData: any = {};

    for (const field of mappingConfig.fields) {
      const value = this.getValueFromSources(sourceData, field.sources);

      if (field.isNestedArray && Array.isArray(value)) {
        this.setNestedArrayValue(
          destinationData,
          field.destination,
          value,
          field.nestedMappingConfig,
        );
      } else if (field.isNestedObject && typeof value === 'object') {
        this.setNestedObjectValue(
          destinationData,
          field.destination,
          value,
          field.nestedMappingConfig,
        );
      } else {
        this.setFieldValue(
          destinationData,
          field.destination,
          field.transform ? field.transform(value) : value,
        );
      }
    }

    // Validate the mapped data using class-validator
    // const validationErrors = validateSync(destinationData);
    // if (validationErrors.length > 0) {
    //   console.error('Validation errors:', validationErrors);
    //   throw new Error('Mapped data validation failed');
    // }

    return destinationData;
  }

  private setNestedObjectValue(
    data: any,
    fieldPath: string,
    objectData: any,
    nestedMappingConfig: MappingConfig,
  ): void {
    const mappedObject = this.map(objectData, nestedMappingConfig);
    this.setFieldValue(data, fieldPath, mappedObject);
  }

  private setNestedArrayValue(
    data: any,
    fieldPath: string,
    arrayData: any[],
    nestedMappingConfig: MappingConfig,
  ): void {
    const mappedArray = arrayData.map((item) =>
      this.map(item, nestedMappingConfig),
    );
    this.setFieldValue(data, fieldPath, mappedArray);
  }

  private setFieldValue(data: any, fieldPath: string, value: any): void {
    const pathSegments = fieldPath.split('.');
    const lastIndex = pathSegments.length - 1;

    pathSegments.reduce((obj, key, index) => {
      if (index === lastIndex) {
        obj[key] = value;
      } else {
        obj[key] = obj[key] || {};
        return obj[key];
      }
    }, data);
  }

  // private setFieldValue(data: any, fieldPath: string, value: any): void {
  //   const pathSegments = fieldPath.split('.');
  //   const lastIndex = pathSegments.length - 1;

  //   pathSegments.reduce((obj, key, index) => {
  //     if (index === lastIndex) {
  //       if (
  //         obj[key] &&
  //         typeof obj[key] === 'object' &&
  //         typeof value === 'object'
  //       ) {
  //         // If the destination field is an object, merge the properties from the source object
  //         Object.assign(obj[key], value);
  //       } else {
  //         // Otherwise, assign the value directly
  //         obj[key] = value;
  //       }
  //     } else {
  //       obj[key] = obj[key] || {};
  //       return obj[key];
  //     }
  //   }, data);
  // }

  private getValueFromSources(data: any, sources: string | string[]): any {
    if (Array.isArray(sources)) {
      for (const source of sources) {
        const value = this.getFieldValue(data, source);
        if (value !== undefined && value !== null) {
          return value;
        }
      }
    } else {
      const value = this.getFieldValue(data, sources);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    return null; // or provide a default value if none of the sources exist
  }

  private getFieldValue(data: any, fieldPath: string): any {
    if (!data) return undefined;

    const pathSegments = fieldPath.split('.');
    return pathSegments.reduce(
      (obj, key) => (obj && obj[key] !== 'undefined' ? obj[key] : undefined),
      data,
    );
  }
}
