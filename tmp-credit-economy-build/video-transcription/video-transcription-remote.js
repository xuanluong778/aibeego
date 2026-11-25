"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeVideoUrlMeta = probeVideoUrlMeta;
/**
 * yt-dlp probe helpers for video-transcription API (metadata only, no long download).
 */
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const shared_1 = require("@marketingspa/shared");
function ytDlpBin() {
    return process.env.YT_DLP_PATH?.trim() || 'yt-dlp';
}
function ytDlpNodeBinary() {
    const fromEnv = process.env.YT_DLP_NODE_PATH?.trim() || process.env.NODE_BINARY?.trim();
    if (fromEnv)
        return fromEnv;
    if (process.execPath && (0, fs_1.existsSync)(process.execPath))
        return process.execPath;
    return 'node';
}
function buildCommonArgs() {
    const args = [
        '--no-playlist',
        '--retries',
        '3',
        '--socket-timeout',
        '20',
        '--remote-components',
        process.env.YT_DLP_REMOTE_COMPONENTS?.trim() || 'ejs:github',
        '--js-runtimes',
        `node:${ytDlpNodeBinary()}`,
    ];
    const cookies = process.env.YT_DLP_COOKIES_FILE?.trim();
    if (cookies && (0, fs_1.existsSync)(cookies)) {
        args.push('--cookies', cookies);
    }
    return args;
}
function runCmd(bin, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(bin, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`Timeout chạy ${bin}`));
        }, timeoutMs);
        child.stdout.on('data', (d) => {
            stdout += d.toString();
        });
        child.stderr.on('data', (d) => {
            stderr += d.toString();
        });
        child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0)
                resolve({ stdout, stderr });
            else
                reject(new Error(`${bin} exit ${code}: ${(stderr || stdout).slice(0, 800)}`));
        });
    });
}
async function probeVideoUrlMeta(url, platform) {
    const timeoutMs = Math.min(90_000, shared_1.VIDEO_TRANSCRIPTION_LIMITS.jobTimeoutMs);
    try {
        const { stdout } = await runCmd(ytDlpBin(), [
            ...buildCommonArgs(),
            '--skip-download',
            '--no-warnings',
            '--print',
            '%(.{title,thumbnail,duration})j',
            '--',
            url,
        ], timeoutMs);
        const line = stdout
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.startsWith('{'));
        if (!line) {
            const mapped = (0, shared_1.mapVideoDownloadError)(platform, 'empty metadata');
            throw Object.assign(new Error(mapped.message), { code: mapped.code });
        }
        const parsed = JSON.parse(line);
        return {
            title: parsed.title?.trim() || null,
            thumbnailUrl: parsed.thumbnail?.trim() || null,
            durationSeconds: typeof parsed.duration === 'number' && Number.isFinite(parsed.duration)
                ? parsed.duration
                : null,
        };
    }
    catch (err) {
        if (err && typeof err === 'object' && 'code' in err)
            throw err;
        const raw = err instanceof Error ? err.message : String(err);
        const mapped = (0, shared_1.mapVideoDownloadError)(platform, raw);
        throw Object.assign(new Error(mapped.message), { code: mapped.code });
    }
}
