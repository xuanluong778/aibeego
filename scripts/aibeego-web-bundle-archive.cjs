#!/usr/bin/env node
/**
 * Archive apps/web/tmp/aibeego-next → deploy/aibeego-vps/bundles/<label>-<BUILD_ID>/
 * Updates deploy/aibeego-vps/bundles/manifest.json (tracked in git).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const bundlesRoot = path.join(root, 'deploy/aibeego-vps/bundles');
const defaultSrc = path.join(root, 'apps/web/tmp/aibeego-next');

const args = process.argv.slice(2);
let label = 'release';
let source = defaultSrc;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--label') label = args[++i];
  else if (args[i] === '--source') source = path.resolve(args[++i]);
}

if (!fs.existsSync(path.join(source, 'BUILD_ID'))) {
  console.error('Missing BUILD_ID in', source);
  process.exit(1);
}
const buildId = fs.readFileSync(path.join(source, 'BUILD_ID'), 'utf8').trim();
const dirName = `${label}-${buildId.slice(0, 12)}`;
const dest = path.join(bundlesRoot, dirName);

if (fs.existsSync(dest)) {
  console.log('Bundle already archived:', dest);
} else {
  fs.mkdirSync(bundlesRoot, { recursive: true });
  execSync(`rsync -a --delete "${source}/" "${dest}/"`, { stdio: 'inherit' });
  console.log('Archived →', dest);
}

let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {
  /* */
}

const manifestPath = path.join(bundlesRoot, 'manifest.json');
let manifest = { bundles: [] };
if (fs.existsSync(manifestPath)) {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}
const entry = {
  id: dirName,
  buildId,
  gitSha,
  label,
  path: `deploy/aibeego-vps/bundles/${dirName}`,
  archivedAt: new Date().toISOString(),
};
manifest.bundles = [entry, ...manifest.bundles.filter((b) => b.id !== dirName)].slice(0, 20);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Updated manifest.json');
