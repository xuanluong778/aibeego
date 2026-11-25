import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma } from '@marketingspa/database';

export type SalesIdempotencyOperation =
  | 'PO_RECEIVE'
  | 'ORDER_RETURN'
  | 'PAYMENT'
  | 'REFUND';

type Tx = Prisma.TransactionClient;

export function stablePayloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function requireIdempotencyKey(key: string | undefined | null): string {
  const trimmed = key?.trim();
  if (!trimmed) throw new BadRequestException('Thiếu idempotencyKey');
  if (trimmed.length > 128) throw new BadRequestException('idempotencyKey quá dài');
  return trimmed;
}

export async function loadSalesIdempotentResult<T>(
  tx: Tx,
  opts: {
    organizationId: string;
    operation: SalesIdempotencyOperation;
    idempotencyKey: string;
    payloadHash: string;
  },
): Promise<T | null> {
  const row = await tx.salesOperationIdempotency.findUnique({
    where: {
      organizationId_operation_idempotencyKey: {
        organizationId: opts.organizationId,
        operation: opts.operation,
        idempotencyKey: opts.idempotencyKey,
      },
    },
  });
  if (!row) return null;
  if (row.payloadHash !== opts.payloadHash) {
    throw new ConflictException('Idempotency key đã dùng với payload khác');
  }
  return row.resultJson as T;
}

export async function saveSalesIdempotentResult(
  tx: Tx,
  opts: {
    organizationId: string;
    operation: SalesIdempotencyOperation;
    idempotencyKey: string;
    payloadHash: string;
    resourceId?: string;
    resultJson: unknown;
  },
): Promise<void> {
  try {
    await tx.salesOperationIdempotency.create({
      data: {
        id: randomUUID(),
        organizationId: opts.organizationId,
        operation: opts.operation,
        idempotencyKey: opts.idempotencyKey,
        payloadHash: opts.payloadHash,
        resourceId: opts.resourceId ?? null,
        resultJson: opts.resultJson as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002') {
      const row = await tx.salesOperationIdempotency.findUniqueOrThrow({
        where: {
          organizationId_operation_idempotencyKey: {
            organizationId: opts.organizationId,
            operation: opts.operation,
            idempotencyKey: opts.idempotencyKey,
          },
        },
      });
      if (row.payloadHash !== opts.payloadHash) {
        throw new ConflictException('Idempotency key đã dùng với payload khác');
      }
      return;
    }
    throw err;
  }
}