// Fresh disposable database only; never reads the application's DATABASE_URL.
const fs = require('node:fs'),
  path = require('node:path'),
  { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tmp/sales-import-qa');
fs.mkdirSync(dir, { recursive: true });
let schema = fs.readFileSync(path.join(root, 'packages/database/prisma/schema.prisma'), 'utf8');
for (const model of ['SalesProductImportRow', 'SalesProductImport'])
  schema = schema.replace(new RegExp('\\nmodel ' + model + ' \\{[\\s\\S]*?\\n\\}'), '');
schema = schema.replace(/^\s*salesProductImports\s+SalesProductImport\[\]\r?\n/m, '\n');
const schemaPath = path.join(dir, 'schema.prisma');
fs.writeFileSync(schemaPath, schema);
const env = {
  ...process.env,
  DATABASE_URL:
    'postgresql://salesqa:salesqa-local-only@127.0.0.1:18543/sales_products_qa?schema=public',
};
const cli = path.join(root, 'node_modules/prisma/build/index.js');
execFileSync(process.execPath, [cli, 'db', 'push', '--schema', schemaPath, '--skip-generate'], {
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
    schemaPath,
    '--file',
    path.join(
      root,
      'packages/database/prisma/migrations/20261121130000_sales_product_imports/migration.sql',
    ),
  ],
  { cwd: root, env, stdio: 'inherit' },
);
console.log(
  'PASS: additive product-import migration applied to the previous schema in isolated PostgreSQL',
);
