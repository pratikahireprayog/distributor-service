import { QueryFilter } from './query-filter';
import { QueryGenerationStrategy } from './query-filter.interface';

// MongoDbQueryGenerationStrategy class
export class MongoDbQueryGenerationStrategy implements QueryGenerationStrategy {
  public generateQuery(queryFilter: QueryFilter): any {
    const conditions = queryFilter.getConditions();
    const andConditions = conditions.filter(
      (condition) => condition.logicalOperator === 'AND',
    );
    const orConditions = conditions.filter(
      (condition) => condition.logicalOperator === 'OR',
    );

    const query: any = {};

    if (andConditions.length > 0) {
      query.$and = andConditions.map((condition) => {
        return { [condition.field]: { [condition.operator]: condition.value } };
      });
    }

    if (orConditions.length > 0) {
      query.$or = orConditions.map((condition) => {
        return { [condition.field]: { [condition.operator]: condition.value } };
      });
    }

    const sort = queryFilter.sort;
    const limit = queryFilter.limit;
    const skip = queryFilter.skip;

    if (Object.keys(sort).length > 0) {
      query.$sort = sort;
    }

    if (limit !== undefined) {
      query.$limit = limit;
    }

    if (skip !== undefined) {
      query.$skip = skip;
    }

    return query;
  }
}

// SqlQueryGenerationStrategy class
export class SqlQueryGenerationStrategy implements QueryGenerationStrategy {
  public generateQuery(queryFilter: QueryFilter): any {
    const conditions = queryFilter.getConditions();
    const andConditions = conditions.filter(
      (condition) => condition.logicalOperator === 'AND',
    );
    const orConditions = conditions.filter(
      (condition) => condition.logicalOperator === 'OR',
    );

    let query = '';

    if (andConditions.length > 0) {
      query += andConditions
        .map((condition) => {
          return `${condition.field} ${condition.operator} ${condition.value}`;
        })
        .join(' AND ');
    }

    if (orConditions.length > 0) {
      if (query.length > 0) {
        query += ' OR ';
      }
      query += orConditions
        .map((condition) => {
          return `${condition.field} ${condition.operator} ${condition.value}`;
        })
        .join(' OR ');
    }

    const sort = queryFilter.sort;
    const limit = queryFilter.limit;
    const skip = queryFilter.skip;

    if (Object.keys(sort).length > 0) {
      query += ` ORDER BY ${Object.keys(sort)
        .map((field) => {
          return `${field} ${sort[field]}`;
        })
        .join(', ')}`;
    }

    if (limit !== undefined) {
      query += ` LIMIT ${limit}`;
    }

    if (skip !== undefined) {
      query += ` OFFSET ${skip}`;
    }

    return `SELECT * FROM table WHERE ${query}`;
  }
}

// QueryGenerator class
export class QueryGenerator {
  private strategy: QueryGenerationStrategy;

  constructor() {
    this.addDefaultStrategy();
  }

  private addDefaultStrategy() {
    this.strategy = new MongoDbQueryGenerationStrategy();
  }

  public setStrategy(strategy: QueryGenerationStrategy) {
    this.strategy = strategy;
  }

  public generateQuery(queryFilter: QueryFilter): any {
    return this.strategy.generateQuery(queryFilter);
  }
}
