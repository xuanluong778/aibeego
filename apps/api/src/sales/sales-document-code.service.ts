import { Injectable } from '@nestjs/common';
import { Prisma } from '@marketingspa/database';
import { PrismaService } from '../prisma/prisma.service';

export const SALES_DOC_TYPES = {
  SALES_ORDER: 'SALES_ORDER',
  STOCKTAKE: 'STOCKTAKE',
  RETURN: 'RETURN',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  STOCK_RECONCILE: 'STOCK_RECONCILE',
} as const;

export type SalesDocType = (typeof SALES_DOC_TYPES)[keyof typeof SALES_DOC_TYPES];

const DOC_PREFIX: Record<SalesDocType, string> = {
  SALES_ORDER: 'SO',
  STOCKTAKE: 'KK',
  RETURN: 'RT',
  PURCHASE_ORDER: 'PO',
  STOCK_RECONCILE: 'RC',
};

@Injectable()
export class SalesDocumentCodeService {
  constructor(private readonly prisma: PrismaService) {}

  prefixFor(docType: SalesDocType, at = new Date()): { periodKey: string; prefix: string } {
    const y = at.getFullYear();
    const m = String(at.getMonth() + 1).padStart(2, '0');
    const d = String(at.getDate()).padStart(2, '0');
    const periodKey = `${y}${m}${d}`;
    const head = DOC_PREFIX[docType] ?? 'XX';
    return { periodKey, prefix: `${head}-${periodKey}-` };
  }

  async nextInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    docType: SalesDocType,
    at = new Date(),
  ): Promise<string> {
    const { periodKey, prefix } = this.prefixFor(docType, at);
    const rows = await tx.$queryRaw<Array<{ last_value: number }>>`
      INSERT INTO sales_document_sequences (organization_id, doc_type, period_key, last_value)
      VALUES (${organizationId}, ${docType}, ${periodKey}, 1)
      ON CONFLICT (organization_id, doc_type, period_key)
      DO UPDATE SET last_value = sales_document_sequences.last_value + 1
      RETURNING last_value
    `;
    const seq = rows[0]?.last_value ?? 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}