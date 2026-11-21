// Fixed disposable database only. Does not read the application's .env.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tmp/sales-woocommerce-qa');
fs.mkdirSync(dir, { recursive: true });
let schema = fs.readFileSync(path.join(root, 'packages/database/prisma/schema.prisma'), 'utf8');
for (const name of ['WooCommerceConnection', 'WooCommerceProduct'])
  schema = schema.replace(new RegExp('\\nmodel ' + name + ' \\{[\\s\\S]*?\\n\\}'), '');
schema = schema
  .replace(/^.*wooCommerceConnections WooCommerceConnection\[\].*\r?\n/m, '')
  .replace(/^.*websiteSources WooCommerceProduct\[\].*\r?\n/m, '')
  .replace(/^.*wooConnectionId String\?.*\r?\n/m, '')
  .replace(/^.*wooConnection WooCommerceConnection\?.*\r?\n/m, '');
schema = schema.replace(/(model SalesProductImportRow \{[\s\S]*?)\n\s*source\s+Json\?/, '$1');
schema = schema.replace(
  /(model SalesProduct \{[\s\S]*?)\n\s*@@unique\(\[id, organizationId\]\)/,
  '$1',
);
const file = path.join(dir, 'schema.prisma');
fs.writeFileSync(file, schema);
const env = {
  ...process.env,
  DATABASE_URL:
    'postgresql://salesqa:salesqa-local-only@127.0.0.1:18543/sales_products_qa?schema=public',
};
const cli = path.join(root, 'node_modules/prisma/build/index.js');
execFileSync(process.execPath, [cli, 'db', 'push', '--schema', file, '--skip-generate'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
execFileSync(
  process.execPath,
  [
    cli,
    'db',
    'execute',
    '--schema',
    file,
    '--file',
    path.join(
      root,
      'packages/database/prisma/migrations/20261121150000_sales_woocommerce_import/migration.sql',
    ),
  ],
  { cwd: root, env, stdio: 'inherit' },
);
console.log('PASS: new WooCommerce migration applied to pre-feature schema in disposable database');
