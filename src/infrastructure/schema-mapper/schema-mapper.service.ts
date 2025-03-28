import { Injectable } from "@nestjs/common";
import { ISchemaMapper } from "./schema-mapper.interface";
import {
  MappingField,
  SchemaMappingConfig,
} from "./schema-mapper.config.interface";

@Injectable()
export class SchemaMapperService<TSource, TTarget>
  implements ISchemaMapper<TSource, TTarget>
{
  constructor() {}

  private convertTransformToFunction(
    transform: string | ((value: any) => any)
  ): (value: any) => any {
    if (typeof transform === "function") {
      return transform;
    }

    // Check if the transform is an arrow function
    if (transform.includes("=>")) {
      // Extract the parameter and body parts
      const arrowMatch = transform.match(/\(([^)]*)\)\s*=>\s*(.*)/);
      if (arrowMatch) {
        const [, params, body] = arrowMatch;
        // Create a function with the extracted parameters and body
        // Use type assertion to tell TypeScript this is the correct type
        return new Function(params, `return ${body}`) as (value: any) => any;
      }
    }

    // Default case: treat as a direct expression
    return new Function("value", `return ${transform}`) as (value: any) => any;
  }

  map(sourceData: any, mappingConfig: SchemaMappingConfig): any {
    const destinationData: any = {};

    for (const field of mappingConfig.fields) {
      const value = this.getValueFromSources(sourceData, field);
      if (
        (value !== undefined && value !== null) ||
        field.defaultValue ||
        field.transform
      ) {
        if (field.isNestedArray && Array.isArray(value)) {
          this.setNestedArrayValue(
            destinationData,
            value,
            field,
            field.nestedMappingConfig
          );
        } else if (field.isNestedObject && typeof value === "object") {
          this.setNestedObjectValue(
            destinationData,
            value,
            field,
            field.nestedMappingConfig
          );
        } else {
          const transformFn = field.transform
            ? this.convertTransformToFunction(field.transform)
            : null;
          this.setFieldValue(
            destinationData,
            transformFn ? transformFn(value) : value,
            field
          );
        }
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
    objectData: any,
    field: MappingField,
    nestedMappingConfig: SchemaMappingConfig
  ): void {
    const mappedObject = this.map(objectData, nestedMappingConfig);
    this.setFieldValue(data, mappedObject, field);
  }

  private setNestedArrayValue(
    data: any,
    arrayData: any[],
    field: MappingField,
    nestedMappingConfig: SchemaMappingConfig
  ): void {
    const mappedArray = arrayData.map((item) =>
      this.map(item, nestedMappingConfig)
    );
    this.setFieldValue(data, mappedArray, field);
  }
  // field.destination,
  // field.transform ? field.transform(value) : value,
  // field.defaultValue,
  // field?.isArrayInDestination

  private setFieldValue(data: any, value: any, field: MappingField): void {
    const pathSegments = field.destination.split(".");
    const lastIndex = pathSegments.length - 1;

    pathSegments.reduce((obj, key, index) => {
      if (index === lastIndex) {
        obj[key] =
          value !== undefined && value !== null ? value : field?.defaultValue;
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

  private getValueFromSources(data: any, field: MappingField): any {
    if (Array.isArray(field.sources)) {
      const values = [];
      for (const source of field.sources) {
        const value = this.getFieldValue(data, source);
        values.push({ [source]: value });
      }
      return values;
    } else {
      if (!field.sources && field.isArrayInDestination) {
        return [data];
      }
      if (!field.sources && field.isNestedObject) {
        return data;
      }
      const value = this.getFieldValue(data, field.sources);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    return null; // or provide a default value if none of the sources exist
  }

  private getFieldValue(data: any, fieldPath: string): any {
    if (!data) return undefined;

    const pathSegments = fieldPath.split(".");
    return pathSegments.reduce(
      (obj, key) => (obj && obj[key] !== "undefined" ? obj[key] : undefined),
      data
    );
  }
}
