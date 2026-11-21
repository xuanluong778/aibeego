// Disposable QA database only; never uses the application's DATABASE_URL.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..'),
  dir = path.join(root, 'tmp/sales-product-ux-qa');
fs.mkdirSync(dir, { recursive: true });
const url =
  'postgresql://salesqa:salesqa-local-only@127.0.0.1:18543/sales_products_qa?schema=public';
process.env.DATABASE_URL = url;
let schema = fs.readFileSync(path.join(root, 'packages/database/prisma/schema.prisma'), 'utf8');
schema = schema
  .replace(/(model SalesProduct \{[\s\S]*?)\n\s*model\s+String\?[^\r\n]*/, '$1')
  .replace(/(model SalesProduct \{[\s\S]*?)\n\s*@@index\(\[organizationId, model\]\)/, '$1');
const schemaFile = path.join(dir, 'schema.prisma');
fs.writeFileSync(schemaFile, schema);
const cli = path.join(root, 'node_modules/prisma/build/index.js');
execFileSync(process.execPath, [cli, 'db', 'push', '--schema', schemaFile, '--skip-generate'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
const { PrismaClient } = require('../packages/database/dist');
const db = new PrismaClient();
(async () => {
  assert.equal(
    (await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,
    'sales_products_qa',
  );
  const org = await db.organization.create({
    data: { name: 'Model migration QA', slug: 'model-qa-' + randomUUID() },
  });
  const connection = await db.wooCommerceConnection.create({
    data: {
      organizationId: org.id,
      websiteUrl: 'https://example.invalid/',
      credentials: 'synthetic-only',
      currency: 'VND',
    },
  });
  const id = randomUUID();
  await db.$executeRaw`INSERT INTO sales_products (id,organization_id,name,updated_at) VALUES (${id},${org.id},'Migration model fixture',NOW())`;
  await db.wooCommerceProduct.create({
    data: {
      organizationId: org.id,
      connectionId: connection.id,
      externalId: '1',
      productId: id,
      snapshot: {
        description: '<ul><li><strong>Model: Hyundai HD-1000VA</strong></li></ul>',
        attributes: [],
      },
    },
  });
  execFileSync(
    process.execPath,
    [
      cli,
      'db',
      'execute',
      '--schema',
      schemaFile,
      '--file',
      path.join(
        root,
        'packages/database/prisma/migrations/20261121170000_sales_product_model/migration.sql',
      ),
    ],
    { cwd: root, env: process.env, stdio: 'inherit' },
  );
  assert.equal(
    (await db.salesProduct.findUnique({ where: { id }, select: { model: true } })).model,
    'Hyundai HD-1000VA',
  );
  console.log(
    'PASS: additive model migration and explicit HTML Model backfill on pre-feature schema',
  );
})()
  .finally(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
