import { Module } from '@nestjs/common';
import { SchemaMapperService } from './schema-mapper.service';

@Module({
  providers: [SchemaMapperService],
  exports: [SchemaMapperService],
})
export class SchemaMapperModule {}
