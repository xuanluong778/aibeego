/**
 * pnpm junctions in this workspace are not readable. Resolve packages from the
 * real .pnpm store and the workspace packages instead.
 */
const Module = require('module');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pnpmDir = path.join(root, 'node_modules', '.pnpm');
const folders = fs.readdirSync(pnpmDir);
const orig = Module._resolveFilename;

const workspace = {
  '@marketingspa/database': path.join(root, 'packages', 'database'),
  '@marketingspa/shared': path.join(root, 'packages', 'shared'),
  '@marketingspa/config': path.join(root, 'packages', 'config'),
};

function packageName(request) {
  if (request.startsWith('@')) {
    const [scope, name] = request.split('/');
    return name ? `${scope}/${name}` : request;
  }
  return request.split('/')[0];
}

function nodeModulesFor(pkg) {
  const key = pkg.startsWith('@') ? pkg.replace('/', '+') : pkg;
  const folder = folders.find((name) => name.startsWith(`${key}@`));
  if (!folder) return null;
  const dir = path.join(pnpmDir, folder, 'node_modules');
  return fs.existsSync(path.join(dir, ...pkg.split('/'))) ? dir : null;
}

Module._resolveFilename = function resolveFromStore(request, parent, isMain, options) {
  try {
    return orig.call(this, request, parent, isMain, options);
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' || !request || request.startsWith('.') || path.isAbsolute(request)) {
      throw error;
    }
    const pkg = packageName(request);
    const workspaceDir = workspace[pkg];
    if (workspaceDir) {
      if (request === pkg) {
        const pkgJson = JSON.parse(fs.readFileSync(path.join(workspaceDir, 'package.json'), 'utf8'));
        return path.join(workspaceDir, pkgJson.main || 'index.js');
      }
      return path.join(workspaceDir, request.slice(pkg.length + 1));
    }
    const nodeModules = nodeModulesFor(pkg);
    if (!nodeModules) throw error;
    return orig.call(this, request, parent, isMain, {
      ...options,
      paths: [nodeModules, ...(options && options.paths ? options.paths : [])],
    });
  }
};
