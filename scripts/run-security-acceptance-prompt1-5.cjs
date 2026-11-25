/**
 * Cổng nghiệm thu bảo mật Prompt 1–6.
 * Chế độ: SECURITY_ACCEPTANCE_MODE=offline|full (mặc định: full nếu Docker sẵn, else offline).
 * CI offline: SECURITY_ACCEPTANCE_MODE=offline
 */
const { spawnSync } = require('child_process');
const { resolve } = require('path');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { printQaBanner, dockerQaStackReady, resolveApiUrl } = require('./lib/security-acceptance-qa-env.cjs');
const { scoreSuiteResult, summarizeGate } = require('./lib/security-acceptance-scoring.cjs');
const { buildSharedPackage } = require('./build-shared-package.cjs');

const cwd = resolve(__dirname, '..');
const env = { ...process.env, NODE_OPTIONS: '' };

const mode =
  process.env.SECURITY_ACCEPTANCE_MODE ||
  (process.env.SECURITY_ACCEPTANCE_SKIP_DOCKER === '1' ? 'offline' : dockerQaStackReady() ? 'full' : 'offline');

/** @type {Array<{id:string,label:string,status:string,detail?:string,required:boolean,mode:string}>} */
const suites = [];

/** @type {Array<{id:string,label:string,script:string,required:{offline:boolean,full:boolean},docker?:boolean}>} */
const PLAN = [
  { id: 'scoring-self', label: 'Scoring fixture', script: 'test-security-acceptance-scoring.cjs', required: { offline: true, full: true } },
  { id: 'qa-guard-self', label: 'QA DB/API guard fixture', script: 'test-qa-db-guard.cjs', required: { offline: true, full: true } },
  { id: 'qa-ses-guard-self', label: 'SES API QA guard fixture', script: 'test-qa-ses-api-guard.cjs', required: { offline: true, full: true } },
  { id: 'secrets-scan', label: 'Secrets scan', script: 'scan-committed-secrets.cjs', required: { offline: true, full: true } },
  { id: 'bundle-sql', label: 'Bundle SQL audit', script: 'audit-chatbot-bundle-sql.cjs', required: { offline: true, full: true } },
  { id: 'json-ld', label: 'JSON-LD safe', script: 'test-safe-json-ld.cjs', required: { offline: true, full: true } },
  { id: 'json-ld-sync', label: 'JSON-LD sync', script: 'test-safe-json-ld-sync.cjs', required: { offline: true, full: true } },
  { id: 'lp-tenant', label: 'LP tenant isolation', script: 'test-landing-page-tenant-isolation.cjs', required: { offline: true, full: true } },
  { id: 'shared-build', label: '@marketingspa/shared build', script: null, required: { offline: true, full: true } },
  { id: 'lp-cache-email-unit', label: 'LP cache + email click', script: 'test-public-cache-email-guards.cjs', required: { offline: true, full: true } },
  { id: 'json-ld-auth-mail', label: 'JSON-LD + auth-mail', script: 'run-security-json-ld-auth-mail.cjs', required: { offline: false, full: true }, docker: true },
  { id: 'auth-session', label: 'Auth session Prompt 5', script: 'run-auth-session-http.cjs', required: { offline: false, full: true }, docker: true },
  { id: 'hrm-finance', label: 'HRM + Finance RBAC', script: 'run-hrm-finance-rbac-http.cjs', required: { offline: false, full: true }, docker: true },
  { id: 'lp-cache-http', label: 'LP cache HTTP', script: 'run-landing-page-cache-http.cjs', required: { offline: false, full: true }, docker: true },
  { id: 'prompt3-ssrf', label: 'URL fetch SSRF', script: 'run-prompt3-url-fetch-qa.cjs', required: { offline: false, full: true }, docker: true },
  { id: 'email-ses-p0', label: 'SES P0 fixture', script: 'run-email-ses-p0-qa.cjs', required: { offline: false, full: true }, docker: true },
  { id: 'lp-saas-ready', label: 'LP SaaS gates', script: 'test-landing-page-saas-ready.cjs', required: { offline: true, full: false } },
];

function isRequired(item) {
  return Boolean(item.required[mode]);
}

function runScript(id, label, scriptRel, required) {
  const script = resolve(cwd, 'scripts', scriptRel);
  if (!existsSync(script)) {
    suites.push({ id, label, status: 'CHƯA KIỂM CHỨNG', detail: 'script missing', required, mode });
    return;
  }
  console.log(`\n========== ${label} (${id}) ==========`);
  const r = spawnSync(process.execPath, [script], {
    cwd,
    encoding: 'utf8',
    env,
    maxBuffer: 20 * 1024 * 1024,
  });
  const combined = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (combined.trim()) process.stdout.write(combined);
  const status = scoreSuiteResult({
    exitCode: r.status,
    blocked: false,
    required,
    stdout: combined,
  });
  suites.push({
    id,
    label,
    status,
    detail: `exit=${r.status ?? '?'} mode=${mode}`,
    required,
    mode,
  });
  console.log(`[${id}] ${status}`);
}

try {
  const banner = printQaBanner();
  console.log(`\n[security-acceptance] MODE=${mode} — không deploy production`);
  console.log(`[security-acceptance] DB QA=${banner.dbName}`);
} catch (e) {
  console.error(`[security-acceptance] FAIL — ${e.message}`);
  process.exit(1);
}

for (const item of PLAN) {
  const required = isRequired(item);
  if (item.id === 'shared-build') {
    console.log(`\n========== ${item.label} ==========`);
    const built = buildSharedPackage(cwd);
    const combined = built.ok ? `[shared-build] PASS — ${built.detail}` : `[shared-build] FAIL — ${built.detail}`;
  if (!built.ok) console.error(combined);
  else console.log(combined);
    const status = scoreSuiteResult({
      exitCode: built.ok ? 0 : 1,
      required,
      stdout: combined,
    });
    suites.push({
      id: item.id,
      label: item.label,
      status,
      detail: built.detail,
      required,
      mode,
    });
    console.log(`[${item.id}] ${status} — ${built.detail}`);
    continue;
  }

  if (item.docker && mode === 'offline') {
    suites.push({
      id: item.id,
      label: item.label,
      status: 'CHƯA KIỂM CHỨNG',
      detail: 'CI offline — bỏ qua docker suite',
      required: false,
      mode,
    });
    console.log(`[${item.id}] CHƯA KIỂM CHỨNG — offline skip (không bắt buộc)`);
    continue;
  }

  if (item.docker && !dockerQaStackReady()) {
    const status = required ? 'CHƯA KIỂM CHỨNG' : 'CHƯA KIỂM CHỨNG';
    suites.push({
      id: item.id,
      label: item.label,
      status,
      detail: 'blocker: marketingspa-api/postgres',
      required,
      mode,
    });
    console.log(`[${item.id}] ${status} — thiếu Docker QA`);
    continue;
  }

  runScript(item.id, item.label, item.script, required);
}

const checklist = [
  'sepay-webhook',
  'brevo-webhook',
  'woo-import',
  'sales-idem',
  'browser-e2e',
  'dependency-audit',
];
console.log('\n========== CHECKLIST RELEASE (tùy chọn) ==========');
for (const id of checklist) {
  suites.push({
    id,
    label: id,
    status: 'CHƯA KIỂM CHỨNG',
    detail: 'ngoài cổng bắt buộc',
    required: false,
    mode,
  });
}

const summary = summarizeGate(suites, mode);
console.log('\n========== TÓM TẮT CỔNG ==========');
for (const s of suites) {
  console.log(`  [${s.status}] ${s.id}${s.required ? ' *' : ''} — ${s.label}${s.detail ? ` (${s.detail})` : ''}`);
}

const verdict = summary.qaPass ? 'PASS' : 'FAIL';
console.log(
  `\n[security-acceptance] MODE=${mode} QA: ${verdict} | PASS=${summary.pass} FAIL=${summary.fail} CHƯA=${summary.chua} blocking=${summary.blocking}`,
);
if (mode === 'full' && summary.qaPass) {
  console.log('[security-acceptance] Prompt 6 — QA full: PASS (mọi ca bắt buộc)');
}
if (mode === 'offline' && summary.qaPass) {
  console.log('[security-acceptance] Prompt 6 — QA offline: PASS');
}
console.log(
  `[security-acceptance] Release readiness: ${summary.releaseReady ? 'SẴN SÀNG' : 'CHƯA'}`,
);
console.log(`[security-acceptance] API_URL=${resolveApiUrl()}`);

const reportPath = resolve(cwd, 'tmp/security-acceptance-prompt1-5.json');
try {
  mkdirSync(resolve(cwd, 'tmp'), { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify({ at: new Date().toISOString(), mode, suites, ...summary }, null, 2),
  );
  console.log(`[security-acceptance] report: ${reportPath}`);
} catch {
  // ignore
}

process.exit(summary.qaPass ? 0 : 1);