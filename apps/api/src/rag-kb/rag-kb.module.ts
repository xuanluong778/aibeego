import { Module } from '@nestjs/common';
import { RagKbController } from './rag-kb.controller';
import { RagKbService } from './rag-kb.service';
import { RagSourceService } from './rag-source.service';
import { RagRetrievalService } from './rag-retrieval.service';

@Module({
  controllers: [RagKbController],
  providers: [RagKbService, RagSourceService, RagRetrievalService],
  exports: [RagKbService, RagRetrievalService],
})
export class RagKbModule {}
