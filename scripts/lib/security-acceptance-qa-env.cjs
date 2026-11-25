const { spawnSync } = require('child_process');

const ALLOWED_API_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  'marketingspa-nginx',
  'marketingspa-api',
  'marketingspa-api-ses-p0-qa',
  'marketingspa-api-qa',
]);
const QA_DATABASES = new Set(['marketingspa_hrm_finance_qa', 'marketingspa_sales_idem_qa']);

const FORBIDDEN_DB_PATTERNS = [/marketingspa_hrm_finance(?!_qa)/i, /^postgres$/i, /production/i];

function dockerContainerRunning(name) {
  const r = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', name], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() === 'true';
}

function dockerQaStackReady() {
  return dockerContainerRunning('marketingspa-api') && dockerContainerRunning('marketingspa-postgres');
}

function resolveApiUrl() {
  const raw =
    process.env.SECURITY_ACCEPTANCE_API_URL ||
    process.env.API_URL ||
    process.env.AUTH_SESSION_PROXY_URL ||
    'http://127.0.0.1:8080';
  const url = String(raw).replace(/\/$/, '');
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`API_URL không hợp lệ: ${url}`);
  }
  if (!ALLOWED_API_HOSTS.has(host)) {
    throw new Error(
      `Từ chối QA: API_URL host="${host}" không trong allowlist QA (${[...ALLOWED_API_HOSTS].join(', ')})`,
    );
  }
  return url;
}

function parseDbName(url) {
  const m = String(url || '').match(/\/([^/?]+)(?:\?|$)/);
  return m?.[1] ?? null;
}

function assertQaDatabaseName(dbName, label = 'DATABASE') {
  if (!dbName) throw new Error(`${label}: thiếu tên database`);
  if (FORBIDDEN_DB_PATTERNS.some((re) => re.test(dbName))) {
    throw new Error(`${label}: từ chối database vận hành "${dbName}"`);
  }
  if (!QA_DATABASES.has(dbName) && !dbName.endsWith('_qa')) {
    throw new Error(
      `${label}: "${dbName}" không phải DB QA (suffix _qa hoặc ${[...QA_DATABASES].join(', ')})`,
    );
  }
}

/**
 * Xác minh current_database() trên marketingspa-postgres trước khi ghi.
 * @param {string} expectedDb
 * @param {{ skipDocker?: boolean }} [opts]
 */
function assertQaDockerDatabaseLive(expectedDb, opts = {}) {
  assertQaDatabaseName(expectedDb, 'DATABASE_URL');
  if (opts.skipDocker) {
    console.log(`[qa-guard] bỏ qua current_database() (skipDocker)`);
    return expectedDb;
  }
  if (!dockerQaStackReady()) {
    throw new Error('[qa-guard] marketingspa-postgres không chạy — không xác minh được DB');
  }
  const user = process.env.POSTGRES_USER || 'marketingspa';
  const check = spawnSync(
    'docker',
    [
      'exec',
      'marketingspa-postgres',
      'psql',
      '-U',
      user,
      '-d',
      expectedDb,
      '-tAc',
      'SELECT current_database();',
    ],
    { encoding: 'utf8' },
  );
  if (check.status !== 0) {
    throw new Error(
      `[qa-guard] Không truy vấn được DB "${expectedDb}" (creds/host sai?): ${(check.stderr || '').trim()}`,
    );
  }
  const cur = check.stdout.trim();
  if (cur !== expectedDb) {
    throw new Error(`[qa-guard] current_database()="${cur}" khác kỳ vọng "${expectedDb}"`);
  }
  console.log(`[qa-guard] POSTGRES current_database()=${cur}`);
  return cur;
}

/**
 * SES fixture: xác minh API đích (sidecar), Postgres live, DATABASE_URL khớp chính xác fixture.
 * @param {{ dbName: string, apiUrl?: string, apiContainer?: string, skipPostgres?: boolean }} input
 */
function assertQaSesFixture({ dbName, apiUrl, apiContainer, skipPostgres = false }) {
  const container =
    apiContainer || process.env.SES_P0_QA_API_CONTAINER || 'marketingspa-api-ses-p0-qa';
  const prev = process.env.API_URL;
  if (apiUrl) process.env.API_URL = apiUrl.replace(/\/$/, '');
  const api = resolveApiUrl();
  if (prev === undefined) delete process.env.API_URL;
  else process.env.API_URL = prev;

  if (!skipPostgres) {
    assertQaDockerDatabaseLive(dbName);
  }

  if (!dockerContainerRunning(container)) {
    throw new Error(
      `[qa-guard] API QA "${container}" không chạy — không xác minh được đích trước khi ghi`,
    );
  }

  const apiEnv = spawnSync('docker', ['exec', container, 'sh', '-c', 'printenv DATABASE_URL'], {
    encoding: 'utf8',
  });
  if (apiEnv.status !== 0 || !apiEnv.stdout.trim()) {
    throw new Error(`[qa-guard] không đọc DATABASE_URL từ ${container} — dừng`);
  }
  const apiDb = parseDbName(apiEnv.stdout.trim());
  if (!apiDb) {
    throw new Error(`[qa-guard] ${container} DATABASE_URL không parse được`);
  }
  assertQaDatabaseName(apiDb, `${container} DATABASE_URL`);
  if (apiDb !== dbName) {
    throw new Error(
      `[qa-guard] ${container} dùng DB "${apiDb}" — fixture yêu cầu "${dbName}" (không chấp nhận _qa khác)`,
    );
  }
  console.log(`[qa-guard] SES fixture API_URL=${api} container=${container} DB=${dbName}`);
}

function printQaBanner() {
  const api = resolveApiUrl();
  const db =
    process.env.AUTH_SESSION_QA_DB ||
    process.env.SECURITY_ACCEPTANCE_DB ||
    process.env.SECURITY_ACCEPTANCE_DB_NAME ||
    'marketingspa_hrm_finance_qa';
  assertQaDatabaseName(db, 'SECURITY_ACCEPTANCE_DB');
  console.log(`[security-acceptance] API_URL=${api}`);
  console.log(`[security-acceptance] QA DB mặc định=${db}`);
  console.log(`[security-acceptance] docker stack=${dockerQaStackReady() ? 'ready' : 'missing'}`);
  return { apiUrl: api, dbName: db, dockerReady: dockerQaStackReady() };
}

module.exports = {
  ALLOWED_API_HOSTS,
  QA_DATABASES,
  dockerContainerRunning,
  dockerQaStackReady,
  resolveApiUrl,
  parseDbName,
  assertQaDatabaseName,
  assertQaDockerDatabaseLive,
  assertQaSesFixture,
  printQaBanner,
};