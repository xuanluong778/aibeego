"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEnvFilePaths = resolveEnvFilePaths;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Resolve .env files for monorepo: root .env first (shared secrets), then apps/api/.env (local overrides).
 * Paths work from both src/ (dev) and dist/ (prod).
 */
function resolveEnvFilePaths() {
    const apiRoot = (0, path_1.resolve)(__dirname, '../..');
    const rootEnv = (0, path_1.resolve)(apiRoot, '../../.env');
    const localEnv = (0, path_1.resolve)(apiRoot, '.env');
    const candidates = [rootEnv, localEnv, (0, path_1.resolve)(process.cwd(), '.env'), (0, path_1.resolve)(process.cwd(), '../../.env')];
    return [...new Set(candidates)].filter((p) => (0, fs_1.existsSync)(p));
}
