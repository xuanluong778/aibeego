import { PrismaClient } from '@prisma/client';
import { seedSubscriptionCatalog } from './seed-subscription-catalog';
const prisma = new PrismaClient();
seedSubscriptionCatalog(prisma)
  .then(() => console.log('Basic / Pro / VIP: 1, 6, 12 months seeded'))
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
