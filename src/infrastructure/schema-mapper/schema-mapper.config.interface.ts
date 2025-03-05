export interface MappingField {
  sources: string | string[];
  destination: string;
  isArrayInDestination?: boolean;
  isNestedArray?: boolean;
  isNestedObject?: boolean;
  nestedMappingConfig?: MappingConfig;
  transform?: (value: any) => any;
  defaultValue?: any;
}

export interface MappingConfig {
  fields: MappingField[];
}
