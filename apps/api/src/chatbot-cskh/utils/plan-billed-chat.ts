import { CreditLedger, organizationPlan, type PrismaClient } from '@marketingspa/database';
import { randomUUID } from 'node:crypto';

/** Keep legacy contracts; all new plan chatbot channels share credit and monthly reply limits. */
export function planBilledChat<T>(
  db: PrismaClient,
  organizationId: string,
  chat: ((input: T) => Promise<string>) | undefined,
) {
  if (!chat) return undefined;
  return async (input: T) => {
    const referenceId = `chatbot:${randomUUID()}`;
    const { subscription } = await organizationPlan(db, organizationId);
    if (!subscription) throw new Error('SUBSCRIPTION_REQUIRED');
    return new CreditLedger(db).runPaidFeature({
      organizationId,
      featureCode: 'chatbot.reply',
      referenceId,
      fn: async (context) => {
        return chat(input);
      },
    });
  };
}
