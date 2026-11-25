import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { creditCallContext, type CreditCallContext } from '@marketingspa/database';
import { creditFeatureForPath } from '@marketingspa/shared';
import { randomUUID } from 'node:crypto';
import { Observable, tap, lastValueFrom } from 'rxjs';
import { CreditService } from '../credit/credit.service';

class ContentNotCreated extends Error {
  constructor(readonly result: unknown) { super('Content was not successfully generated'); }
}

export function isCreatedContent(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const value = result as Record<string, unknown>;
  return value.source === 'ai' && [value.content, value.final_article, value.facebookPost]
    .some(text => typeof text === 'string' && text.trim().length > 0);
}

@Injectable()
export class CreditContextInterceptor implements NestInterceptor {
  constructor(private readonly credit: CreditService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest();
    const path = (request.originalUrl || request.url || '').split('?')[0].toLowerCase().replace(/\/$/, '');
    const state: CreditCallContext = { organizationId: request.user?.organizationId as string | undefined,
      featureCode: creditFeatureForPath(request.originalUrl || request.url || ''),
      referenceId: `ai:${randomUUID()}`, billingError: undefined as Error | undefined };
    if (/(?:^|\/)content-marketing(?:\/|$)/.test(path)) {
      state.contentEditorFree = true;
      const createsContent = request.method === 'POST' && /\/content-marketing\/(?:generate|generate-advanced|opinion\/generate)$/.test(path);
      return new Observable(subscriber => {
        const execute = () => creditCallContext.run(state, () => lastValueFrom(next.handle()));
        const work = createsContent ? this.credit.runPaidFeature({
          organizationId: state.organizationId!, featureCode: 'content_ai.generate', referenceId: `${state.referenceId}:created`,
          metadata: { successOnly: true, flatPerRequest: true, pricingVersion: 'content-success-20261122' },
          fn: async () => {
            const result = await execute();
            if (!isCreatedContent(result)) throw new ContentNotCreated(result);
            return result;
          },
        }).catch(error => { if (error instanceof ContentNotCreated) return error.result; throw error; }) : execute();
        work.then(result => { subscriber.next(result); subscriber.complete(); }, error => subscriber.error(error));
      });
    }
    if (['content_ai.generate', 'content_ai.suggest'].includes(state.featureCode))
      state.flatContentBilling = { referenceId: `${state.referenceId}:content`, charged: false };
    return new Observable(subscriber => creditCallContext.run(state, () => {
      const subscription = next.handle().pipe(tap(() => {
        // Some legacy feature logic returns a fallback after catching provider errors.
        // Insufficient credit must still reach the client as an error.
        if (state.billingError) throw state.billingError;
      })).subscribe(subscriber);
      return () => subscription.unsubscribe();
    }));
  }
}
