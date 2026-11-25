import { AsyncLocalStorage } from 'node:async_hooks';

export type CreditCallContext = {
  organizationId?: string;
  featureCode: string;
  referenceId: string;
  prepaid?: boolean;
  markProviderStarted?: () => void;
  providerCalls?: number;
  billingError?: Error;
  /** Content editor: billing is settled at the completed content boundary. */
  contentEditorFree?: boolean;
  flatContentBilling?: { referenceId: string; charged: boolean; pending?: Promise<void> };
};
export const creditCallContext = new AsyncLocalStorage<CreditCallContext>();
