export interface MappingField {
  sources: string | string[];
  destination: string;
  isArrayInDestination?: boolean;
  isNestedArray?: boolean;
  isNestedObject?: boolean;
  nestedMappingConfig?: SchemaMappingConfig;
  transform?:  string | ((value: any) => any);
  defaultValue?: any;
}

export interface SchemaMappingConfig {
  fields: MappingField[];
}
