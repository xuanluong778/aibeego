import { Global, Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CreditContextInterceptor } from './credit-context.interceptor';

@Global()
@Module({
  providers: [OpenAiService, { provide: APP_INTERCEPTOR, useClass: CreditContextInterceptor }],
  exports: [OpenAiService],
})
export class OpenAiModule {}
