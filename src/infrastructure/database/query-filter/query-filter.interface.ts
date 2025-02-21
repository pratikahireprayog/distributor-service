// QueryGenerationStrategy interface
import { QueryFilter } from './query-filter';

export interface QueryGenerationStrategy {
  generateQuery(queryFilter: QueryFilter): any;
}
