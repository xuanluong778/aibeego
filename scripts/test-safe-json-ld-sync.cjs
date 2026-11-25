/** Đảm bảo test .cjs khớp source TypeScript */
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const src = readFileSync(resolve(__dirname, '../apps/web/src/lib/safe-json-ld.ts'), 'utf8');
assert.ok(src.includes('.replace(/</g, \'\\\\u003c\')'));
assert.ok(src.includes('.replace(/>/g, \'\\\\u003e\')'));
console.log('[PASS] safe-json-ld.ts giữ serializer đồng bộ với test');