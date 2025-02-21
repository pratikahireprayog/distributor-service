import { QueryGenerator } from './query-filter-generator';
// Operator class
class Operator {
  private static operators: { [key: string]: string } = {
    '=': '=',
    '==': '=',
    EQUAL: '=',
    equal: '=',
    '!=': '!=',
    '<>': '!=',
    NOT_EQUAL: '!=',
    not_equal: '!=',
    '>': '>',
    GREATER_THAN: '>',
    greater_than: '>',
    '<': '<',
    LESS_THAN: '<',
    less_than: '<',
    '>=': '>=',
    GREATER_THAN_OR_EQUAL: '>=',
    greater_than_or_equal: '>=',
    '<=': '<=',
    LESS_THAN_OR_EQUAL: '<=',
    less_than_or_equal: '<=',
    IN: 'IN',
    in: 'IN',
    NOT_IN: 'NOT IN',
    not_in: 'NOT IN',
    IS_NULL: 'IS NULL',
    is_null: 'IS NULL',
    IS_NOT_NULL: 'IS NOT NULL',
    is_not_null: 'IS NOT NULL',
  };

  public static getOperator(key: string): string {
    return this.operators[key.toUpperCase()];
  }

  public static isValidOperator(key: string): boolean {
    return this.operators[key.toUpperCase()] !== undefined;
  }
}

// QueryFilter class
export class QueryFilter {
  private conditions: any[] = [];
  private sortBy: any = {};
  private limitTo: number | undefined;
  private skipTo: number | undefined;
  private queryGenerator: QueryGenerator;

  constructor(queryGenerator: QueryGenerator = new QueryGenerator()) {
    this.queryGenerator = queryGenerator;
  }

  public getConditions(): any[] {
    return this.conditions;
  }

  public where(
    field: string,
    operator: string,
    value: any,
    logicalOperator: 'AND' | 'OR' = 'AND',
  ): this {
    this.conditions.push({ field, operator, value, logicalOperator });
    return this;
  }

  public andWhere(field: string, operator: string, value: any): this {
    return this.where(field, operator, value, 'AND');
  }

  public orWhere(field: string, operator: string, value: any): this {
    return this.where(field, operator, value, 'OR');
  }

  public in(field: string, values: any[]): this {
    this.conditions.push({
      field,
      operator: Operator.getOperator('IN'),
      value: values,
    });
    return this;
  }

  public notIn(field: string, values: any[]): this {
    this.conditions.push({
      field,
      operator: Operator.getOperator('NOT IN'),
      value: values,
    });
    return this;
  }

  public isNull(field: string): this {
    this.conditions.push({
      field,
      operator: Operator.getOperator('IS NULL'),
      value: null,
    });
    return this;
  }

  public isNotNull(field: string): this {
    this.conditions.push({
      field,
      operator: Operator.getOperator('IS NOT NULL'),
      value: null,
    });
    return this;
  }

  public sort(field: string, order: 'ASC' | 'DESC'): this {
    this.sortBy[field] = order === 'ASC' ? 1 : -1;
    return this;
  }

  public limit(limit: number): this {
    this.limitTo = limit;
    return this;
  }

  public skip(skip: number): this {
    this.skipTo = skip;
    return this;
  }

  public getQuery(): any {
    return this.queryGenerator.generateQuery(this);
  }
}
