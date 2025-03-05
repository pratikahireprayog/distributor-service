export interface ISchemaMapper<TSource, TTarget> {
  map(source: TSource, settings: any): TTarget;
}
