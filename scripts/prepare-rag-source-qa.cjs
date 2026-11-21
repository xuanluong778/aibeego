// Isolated, disposable PostgreSQL only. Never reads a database URL from .env.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let schema = fs.readFileSync(path.join(root, 'packages/database/prisma/schema.prisma'), 'utf8');
schema = schema
  .replace(/\nmodel RagKbChunk \{[\s\S]*?\n\}/, '')
  .replace(/^  chunks\s+RagKbChunk\[\]\r?\n/m, '')
  .replace(/^  @@unique\(\[id, knowledgeBaseId, organizationId\]\)\r?\n/m, '');
schema = schema
  .replace(/\nmodel RagKbSource \{[\s\S]*?\n\}/, '')
  .replace(/^  sources      RagKbSource\[\]\r?\n/m, '')
  .replace(/^  @@unique\(\[id, organizationId\]\)\r?\n/m, '');
// Limit field removal to RagKbDocument; unrelated sourceId fields stay intact.
const doc = schema.match(/model RagKbDocument \{[\s\S]*?\n\}/)[0];
const legacyDoc = doc
  .replace(
    /^  (?:sourceId|externalId|contentHash|sourceUpdatedAt|syncedAt|manualEditedAt|source)\s+[^\r\n]*\r?\n/gm,
    '',
  )
  .replace(/^  @@unique\(\[sourceId, externalId\]\)\r?\n/m, '');
schema = schema.replace(doc, legacyDoc);
fs.mkdirSync(path.join(root, 'tmp/rag-source-qa'), { recursive: true });
const baseline = path.join(root, 'tmp/rag-source-qa/schema.prisma');
fs.writeFileSync(baseline, schema);
const env = {
  ...process.env,
  DATABASE_URL: 'postgresql://ragqa:ragqa-local-only@127.0.0.1:15489/rag_source_qa?schema=public',
};
const prisma = path.join(root, 'node_modules/prisma/build/index.js');
execFileSync(process.execPath, [prisma, 'db', 'push', '--schema', baseline, '--skip-generate'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
execFileSync(
  process.execPath,
  [
    prisma,
    'db',
    'execute',
    '--schema',
    baseline,
    '--file',
    path.join(
      root,
      'packages/database/prisma/migrations/20261120140000_rag_external_sources/migration.sql',
    ),
  ],
  { cwd: root, env, stdio: 'inherit' },
);
console.log('PASS: additive migration applied to isolated legacy schema');
execFileSync(
  process.execPath,
  [
    prisma,
    'db',
    'execute',
    '--schema',
    baseline,
    '--file',
    path.join(
      root,
      'packages/database/prisma/migrations/20261120160000_rag_text_retrieval/migration.sql',
    ),
  ],
  { cwd: root, env, stdio: 'inherit' },
);
console.log('PASS: real text chunk index migration applied');
execFileSync(process.execPath, [prisma, 'db', 'execute', '--schema', baseline, '--file', path.join(root, 'packages/database/prisma/migrations/20261120180000_rag_website_summary/migration.sql')], { cwd: root, env, stdio: 'inherit' });
console.log('PASS: internal website page snapshots migration applied');
