/**
 * API QA sidecar — không đổi DATABASE_URL của marketingspa-api vận hành.
 */
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_CONTAINER = 'marketingspa-api-ses-p0-qa';
const DEFAULT_PORT = '4102';

function dockerContainerRunning(name) {
  const r = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', name], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() === 'true';
}

function qaPostgresNetwork() {
  return String(
    spawnSync('docker', ['inspect', 'marketingspa-postgres', '--format', '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}'], {
      encoding: 'utf8',
    }).stdout || '',
  ).trim();
}

/**
 * @param {string} container
 * @param {string} expectedDb
 */
function assertApiContainerDatabase(container, expectedDb) {
  const apiEnv = spawnSync('docker', ['exec', container, 'sh', '-c', 'printenv DATABASE_URL'], {
    encoding: 'utf8',
  });
  if (apiEnv.status !== 0 || !apiEnv.stdout.trim()) {
    throw new Error(
      `[qa-guard] không đọc được DATABASE_URL từ ${container} — dừng trước khi ghi fixture`,
    );
  }
  const m = String(apiEnv.stdout.trim()).match(/\/([^/?]+)(?:\?|$)/);
  const apiDb = m?.[1] ?? null;
  if (!apiDb) {
    throw new Error(`[qa-guard] ${container} DATABASE_URL không parse được tên DB`);
  }
  if (apiDb !== expectedDb) {
    throw new Error(
      `[qa-guard] ${container} DATABASE_URL="${apiDb}" khác fixture "${expectedDb}" (kể cả DB _qa khác)`,
    );
  }
  console.log(`[qa-guard] ${container} DATABASE_URL DB=${apiDb} (khớp fixture)`);
  return apiDb;
}

/**
 * @param {{ dbName: string, repoRoot?: string, container?: string, port?: string, extraEnv?: Record<string,string> }} opts
 * @returns {{ apiUrl: string, container: string, port: string }}
 */
function ensureSesP0ApiQa(opts) {
  const repoRoot = opts.repoRoot || resolve(__dirname, '..', '..');
  const dbName = opts.dbName;
  const container = opts.container || process.env.SES_P0_QA_API_CONTAINER || DEFAULT_CONTAINER;
  const port = String(opts.port || process.env.SES_P0_QA_API_PORT || DEFAULT_PORT);

  if (!dockerContainerRunning('marketingspa-postgres')) {
    throw new Error('[ses-p0-qa-api] cần marketingspa-postgres');
  }

  const qaNet = qaPostgresNetwork();
  if (!qaNet) throw new Error('[ses-p0-qa-api] không lấy được network postgres');

  const envPath = resolve(repoRoot, '.env');
  const user = process.env.POSTGRES_USER || 'marketingspa';
  const pass = process.env.POSTGRES_PASSWORD || 'change_me_strong_password';
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      const value = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if ((key === 'POSTGRES_USER' || key === 'POSTGRES_PASSWORD') && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  const internalUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@marketingspa-postgres:5432/${dbName}?schema=public`;

  const apiUrl = `http://127.0.0.1:${port}`;

  if (dockerContainerRunning(container)) {
    assertApiContainerDatabase(container, dbName);
    console.log(`[ses-p0-qa-api] tái sử dụng ${container} → ${apiUrl}`);
    return { apiUrl, container, port };
  }

  const image = String(
    spawnSync('docker', ['inspect', '-f', '{{.Config.Image}}', 'marketingspa-api'], {
      encoding: 'utf8',
    }).stdout || 'marketingspa-api',
  ).trim();
  if (!image) throw new Error('[ses-p0-qa-api] không lấy được image từ marketingspa-api');

  spawnSync('docker', ['rm', '-f', container], { stdio: 'ignore' });

  const distPath = resolve(repoRoot, 'apps/api/dist');
  const useMount = existsSync(resolve(distPath, 'main.js'));
  const envFileArgs = existsSync(envPath) ? ['--env-file', envPath] : [];

  const sesTopic =
    process.env.SES_SNS_TOPIC_ARN || 'arn:aws:sns:ap-southeast-1:000000000000:marketingautoaz-p0-test';
  const sesKey = process.env.SES_SNS_WEBHOOK_TEST_SIGNING_KEY || 'p0-local-test-signing-key';

  /** @type {string[]} */
  const runArgs = [
    'run',
    '-d',
    '--name',
    container,
    '--network',
    qaNet,
    '-p',
    `127.0.0.1:${port}:4000`,
    ...envFileArgs,
    '-e',
    `DATABASE_URL=${internalUrl}`,
    '-e',
    'REDIS_URL=redis://redis:6379',
    '-e',
    `SES_SNS_TOPIC_ARN=${sesTopic}`,
    '-e',
    `SES_SNS_WEBHOOK_TEST_SIGNING_KEY=${sesKey}`,
    '-e',
    'HOST=0.0.0.0',
  ];
  if (useMount) {
    runArgs.push('-v', `${distPath}:/app/dist:ro`);
  }
  runArgs.push(image, 'node', 'dist/main.js');

  const started = spawnSync('docker', runArgs, { stdio: 'inherit' });
  if (started.status !== 0) {
    throw new Error(`[ses-p0-qa-api] không khởi động được ${container}`);
  }

  const deadline = Date.now() + 90_000;
  let healthy = false;
  while (Date.now() < deadline) {
    assertApiContainerDatabase(container, dbName);
    const probe = spawnSync(
      process.execPath,
      [
        '-e',
        `fetch('${apiUrl}/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
      ],
      { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } },
    );
    if (probe.status === 0) {
      healthy = true;
      break;
    }
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, 2000)'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
    });
  }
  if (!healthy) {
    throw new Error(`[ses-p0-qa-api] health timeout ${apiUrl}`);
  }

  console.log(`[ses-p0-qa-api] ${container} sẵn sàng — ${apiUrl} → DB ${dbName}`);
  return { apiUrl, container, port };
}

module.exports = {
  DEFAULT_CONTAINER,
  DEFAULT_PORT,
  ensureSesP0ApiQa,
  assertApiContainerDatabase,
  dockerContainerRunning,
};