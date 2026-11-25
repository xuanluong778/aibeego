import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@marketingspa/database';

export async function assertBranchInOrg(
  db: Prisma.TransactionClient | { branch: { findFirst: Function } },
  organizationId: string,
  branchId: string | null | undefined,
) {
  if (!branchId) return;
  const branch = await (db as any).branch.findFirst({
    where: { id: branchId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!branch) {
    throw new BadRequestException('Chi nhánh không thuộc tổ chức hoặc không hoạt động');
  }
}