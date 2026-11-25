import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { CREDIT_PRICING } from '@marketingspa/shared';
const prisma = new PrismaClient();

async function main() {
  for (const row of CREDIT_PRICING) {
    await prisma.creditFeaturePricing.upsert({
      where: { featureCode: row.featureCode },
      update: {
        name: row.name,
        description: row.description,
        sortOrder: row.sortOrder,
        isActive: true,
      },
      create: {
        featureCode: row.featureCode,
        name: row.name,
        creditCost: new Decimal(row.creditCost),
        description: row.description,
        sortOrder: row.sortOrder,
        isActive: true,
      },
    });
  }
  const rows = await prisma.creditFeaturePricing.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log(rows.map((r) => ({ code: r.featureCode, cost: String(r.creditCost) })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
