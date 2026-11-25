/**
 * Sidecar QA cho URL fetch — không ghi đè marketingspa-api đang phục vụ.
 */
const { spawnSync } = require('child_process');

const CONTAINER = process.env.URL_FETCH_QA_CONTAINER || 'marketingspa-api-url-fetch-qa';

function ensureUrlFetchQaSidecar() {
  const running = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER], {
    encoding: 'utf8',
  });
  if (String(running.stdout || '').trim() === 'true') return CONTAINER;

  const image =
    process.env.URL_FETCH_QA_IMAGE ||
    String(
      spawnSync('docker', ['inspect', '-f', '{{.Config.Image}}', 'marketingspa-api'], {
        encoding: 'utf8',
      }).stdout || '',
    ).trim();

  if (!image) {
    console.error(
      '[url-fetch-qa] Cần container marketingspa-api (để lấy image) hoặc set URL_FETCH_QA_IMAGE',
    );
    process.exit(1);
  }

  spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
  const started = spawnSync(
    'docker',
    ['run', '-d', '--name', CONTAINER, image, 'sleep', 'infinity'],
    { stdio: 'inherit' },
  );
  if (started.status !== 0) process.exit(started.status ?? 1);
  console.log(`[url-fetch-qa] sidecar ${CONTAINER} (image ${image})`);
  return CONTAINER;
}

module.exports = { CONTAINER, ensureUrlFetchQaSidecar };