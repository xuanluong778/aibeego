/**
 * Prompt 3 — URL fetch QA: sidecar docker + regression LP / RAG / Woo (shared ssrf-fetch).
 */
const { resolve } = require('path');
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const { CONTAINER } = require('./url-fetch-qa-sidecar.cjs');

const cwd = resolve(__dirname, '..');

function runNode(args, label) {
  console.log(`\n[prompt3-url-fetch] ${label}`);
  const r = spawnSync(process.execPath, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  if (r.status !== 0) {
    console.error(`[prompt3-url-fetch] FAIL — ${label}`);
    process.exit(r.status ?? 1);
  }
}

runNode([resolve(__dirname, 'run-user-url-fetch-qa.cjs')], 'docker sidecar (ssrf + policy caption)');

const lpDocker = resolve(__dirname, 'test-landing-page-ssrf-regression.docker.cjs');
spawnSync('docker', ['cp', lpDocker, `${CONTAINER}:/tmp/test-landing-page-ssrf-regression.cjs`], {
  cwd,
  stdio: 'inherit',
});
const lp = spawnSync(
  'docker',
  ['exec', '-w', '/tmp', CONTAINER, 'node', 'test-landing-page-ssrf-regression.cjs'],
  { cwd, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } },
);
if (lp.status !== 0) {
  console.error('[prompt3-url-fetch] FAIL — Landing Page ssrf regression (docker)');
  process.exit(lp.status ?? 1);
}
console.log('\n[prompt3-url-fetch] Landing Page ssrf regression PASS');

function tryRegression(label, scriptName) {
  console.log(`\n[prompt3-url-fetch] ${label}`);
  const r = spawnSync(process.execPath, [resolve(__dirname, scriptName)], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  if (r.status === 0) {
    console.log(`[prompt3-url-fetch] ${label} PASS`);
    return true;
  }
  console.log(`[prompt3-url-fetch] ${label} — CHƯA KIỂM CHỨNG (môi trường QA DB/Redis hoặc build dist thiếu)`);
  return false;
}

const ragOk = tryRegression('RAG external sources', 'test-rag-external-sources.cjs');
const wooOk = tryRegression('Sales WooCommerce', 'test-sales-woocommerce.cjs');

console.log('\n[prompt3-url-fetch] PASS (docker ssrf + LP regression)');
if (!ragOk || !wooOk) {
  console.log('[prompt3-url-fetch] RAG/Woo: xem log trên — cần prepare-rag-source-qa / sales_products_qa');
}
console.log(
  '[prompt3-url-fetch] Browser: CHƯA KIỂM CHỨNG — Chatbot crawl + Facebook policy trên web QA (api-qa :4001)',
);