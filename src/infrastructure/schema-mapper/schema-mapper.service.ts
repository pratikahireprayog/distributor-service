import { Injectable } from '@nestjs/common';
import { ISchemaMapper } from './schema-mapper.interface';
import {
  MappingField,
  SchemaMappingConfig,
} from './schema-mapper.config.interface';

@Injectable()
export class SchemaMapperService<TSource, TTarget>
  implements ISchemaMapper<TSource, TTarget> {
  constructor() { }

  private convertTransformToFunction(transform: string | ((value: any) => any)): (value: any) => any {
    if (typeof transform === 'function') {
      return transform;
    }

    try {
      // Convert string to function safely with proper typing
      const fn = new Function('value', `return ${transform}`) as (value: any) => any;
      return fn;
    } catch (error) {
      console.error('Error creating transform function:', error);
      return (value: any) => value; // Return identity function on error
    }
  }

  map(sourceData: TSource, mappingConfig: SchemaMappingConfig): TTarget {
    const destinationData: any = {};

    for (const field of mappingConfig.fields) {
      if (field.isArrayInDestination && !field.sources) {
        this.setFieldValue(destinationData, field.defaultValue || [], field);
        continue;
      }

      const value = this.getValueFromSources(sourceData, field);
      
      if (value !== undefined || field.defaultValue !== undefined || field.transform) {
        let transformedValue = value;
        
        if (field.transform) {
          const transformFn = this.convertTransformToFunction(field.transform);
          transformedValue = transformFn(value);
        }

        this.setFieldValue(
          destinationData,
          transformedValue !== undefined ? transformedValue : field.defaultValue,
          field
        );
      }
    }

    return destinationData as TTarget;
  }

  private setNestedObjectValue(
    data: any,
    objectData: any,
    field: MappingField,
    nestedMappingConfig: SchemaMappingConfig,
  ): void {
    const mappedObject = this.map(objectData, nestedMappingConfig);
    this.setFieldValue(data, mappedObject, field);
  }

  private setNestedArrayValue(
    data: any,
    arrayData: any[],
    field: MappingField,
    nestedMappingConfig: SchemaMappingConfig,
  ): void {
    const mappedArray = arrayData.map((item) =>
      this.map(item, nestedMappingConfig),
    );
    this.setFieldValue(data, mappedArray, field);
  }

  private setFieldValue(data: any, value: any, field: MappingField): void {
    const pathSegments = field.destination.split('.');
    let current = data;

    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      
      // Handle array indices
      if (/^\d+$/.test(pathSegments[i + 1])) {
        current[segment] = current[segment] || [];
      } else {
        current[segment] = current[segment] || {};
      }
      
      current = current[segment];
    }

    const lastSegment = pathSegments[pathSegments.length - 1];
    if (value !== undefined) {
      current[lastSegment] = value;
    }
  }

  private getValueFromSources(data: any, field: MappingField): any {
    if (!field.sources) {
      return field.defaultValue;
    }

    if (Array.isArray(field.sources)) {
      const values = field.sources.map(source => this.getFieldValue(data, source));
      return values.every(v => v !== undefined) ? values : undefined;
    }

    return this.getFieldValue(data, field.sources);
  }

  private getFieldValue(data: any, fieldPath: string): any {
    if (!data) return undefined;

    const pathSegments = fieldPath.split('.');
    return pathSegments.reduce(
      (obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined),
      data,
    );
  }
}
