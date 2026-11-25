"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECORDING_TYPES = exports.ALLOWED_RECORDING_MIMES = exports.TELEPROMPTER_RECORDING_LIMITS = void 0;
exports.teleprompterRecordingsRoot = teleprompterRecordingsRoot;
exports.maxRecordingFileBytes = maxRecordingFileBytes;
exports.extForMime = extForMime;
exports.buildStorageKey = buildStorageKey;
exports.absoluteFromKey = absoluteFromKey;
exports.partsDirFromKey = partsDirFromKey;
exports.ensureRecordingDirs = ensureRecordingDirs;
exports.removeRecordingObject = removeRecordingObject;
exports.sniffContainerMime = sniffContainerMime;
exports.mimeCompatible = mimeCompatible;
exports.validateInitParams = validateInitParams;
exports.partEtag = partEtag;
exports.writePart = writePart;
exports.listWrittenParts = listWrittenParts;
exports.assemblePartsAsync = assemblePartsAsync;
exports.assembleParts = assembleParts;
exports.objectSize = objectSize;
exports.openObjectStream = openObjectStream;
exports.objectExists = objectExists;
exports.downloadSigningSecret = downloadSigningSecret;
exports.signDownloadToken = signDownloadToken;
exports.verifyDownloadToken = verifyDownloadToken;
exports.sanitizeTitle = sanitizeTitle;
exports.filenameFromTitle = filenameFromTitle;
/**
 * Disk / S3-compatible layout for teleprompter recordings.
 * storageKey is relative (orgId/recordingId/object.ext) — never expose to clients.
 */
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
exports.TELEPROMPTER_RECORDING_LIMITS = {
    /** Soft max per file (bytes) — env TELEPROMPTER_MAX_FILE_BYTES overrides */
    maxFileBytes: 500 * 1024 * 1024,
    /** Multipart chunk size recommended for clients */
    defaultPartSize: 5 * 1024 * 1024,
    minPartSize: 256 * 1024,
    maxPartSize: 16 * 1024 * 1024,
    maxParts: 2000,
    /** Incomplete upload TTL for cleanup */
    incompleteTtlMs: 24 * 60 * 60 * 1000,
    /** Signed download URL lifetime */
    downloadUrlTtlSec: 10 * 60,
    maxDurationSec: 30 * 60,
    maxTitleLen: 500,
};
exports.ALLOWED_RECORDING_MIMES = new Set([
    'video/webm',
    'video/mp4',
    'video/quicktime',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/x-wav',
]);
exports.RECORDING_TYPES = new Set(['video_audio', 'video_only', 'audio_only']);
function teleprompterRecordingsRoot() {
    const fromEnv = process.env.TELEPROMPTER_UPLOAD_DIR?.trim();
    if (fromEnv)
        return fromEnv;
    return (0, path_1.join)(process.cwd(), '..', '..', 'uploads', 'teleprompter-recordings');
}
function maxRecordingFileBytes() {
    const raw = process.env.TELEPROMPTER_MAX_FILE_BYTES?.trim();
    if (raw && /^\d+$/.test(raw)) {
        return Math.min(Number(raw), 2 * 1024 * 1024 * 1024);
    }
    return exports.TELEPROMPTER_RECORDING_LIMITS.maxFileBytes;
}
function extForMime(mime) {
    const base = mime.split(';')[0]?.trim().toLowerCase() || '';
    if (base.includes('webm'))
        return '.webm';
    if (base.includes('mp4') || base.includes('m4a'))
        return '.mp4';
    if (base.includes('quicktime'))
        return '.mov';
    if (base.includes('mpeg') || base === 'audio/mp3')
        return '.mp3';
    if (base.includes('ogg'))
        return '.ogg';
    if (base.includes('wav'))
        return '.wav';
    return '.bin';
}
function buildStorageKey(organizationId, recordingId, mime) {
    return (0, path_1.join)(organizationId, recordingId, `object${extForMime(mime)}`).replace(/\\/g, '/');
}
function absoluteFromKey(storageKey) {
    // Prevent path traversal
    const clean = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
    if (clean.includes('..') || clean.startsWith('/')) {
        throw new Error('Invalid storage key');
    }
    return (0, path_1.join)(teleprompterRecordingsRoot(), clean);
}
function partsDirFromKey(storageKey) {
    return (0, path_1.join)((0, path_1.dirname)(absoluteFromKey(storageKey)), 'parts');
}
function ensureRecordingDirs(storageKey) {
    const objectAbs = absoluteFromKey(storageKey);
    (0, fs_1.mkdirSync)((0, path_1.dirname)(objectAbs), { recursive: true });
    (0, fs_1.mkdirSync)(partsDirFromKey(storageKey), { recursive: true });
}
function removeRecordingObject(storageKey) {
    if (!storageKey)
        return;
    try {
        const abs = absoluteFromKey(storageKey);
        const dir = (0, path_1.dirname)(abs);
        if ((0, fs_1.existsSync)(dir)) {
            (0, fs_1.rmSync)(dir, { recursive: true, force: true });
        }
    }
    catch {
        // best-effort
    }
}
/** Magic-byte sniff — rejects MIME spoofing (extension/header lie). */
function sniffContainerMime(buf) {
    if (buf.length < 12)
        return null;
    // EBML / WebM / MKV
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
        return 'video/webm'; // container; may be audio/webm — refine by caller mode
    }
    // Ogg
    if (buf.slice(0, 4).toString('ascii') === 'OggS')
        return 'audio/ogg';
    // WAV
    if (buf.slice(0, 4).toString('ascii') === 'RIFF' &&
        buf.slice(8, 12).toString('ascii') === 'WAVE') {
        return 'audio/wav';
    }
    // MP3 frame sync or ID3
    if (buf.slice(0, 3).toString('ascii') === 'ID3')
        return 'audio/mpeg';
    if (buf[0] === 0xff && buf.length > 1 && (buf[1] & 0xe0) === 0xe0)
        return 'audio/mpeg';
    // ISO BMFF (mp4/m4a/mov)
    const ftyp = buf.slice(4, 8).toString('ascii');
    if (ftyp === 'ftyp') {
        const brand = buf.slice(8, 12).toString('ascii').toLowerCase();
        if (brand.startsWith('qt'))
            return 'video/quicktime';
        if (brand.includes('M4A') || brand === 'm4a ' || brand === 'mp41' || brand === 'isom') {
            // m4a vs mp4 — treat as video/mp4 family; audio callers may claim audio/mp4
            return 'video/mp4';
        }
        return 'video/mp4';
    }
    return null;
}
function mimeCompatible(declared, sniffed, recordingType) {
    const d = declared.split(';')[0]?.trim().toLowerCase() || '';
    if (!exports.ALLOWED_RECORDING_MIMES.has(d))
        return false;
    if (!sniffed)
        return false;
    // WebM container
    if (sniffed === 'video/webm') {
        return d.includes('webm');
    }
    // MP4 family
    if (sniffed === 'video/mp4' || sniffed === 'video/quicktime') {
        return d.includes('mp4') || d.includes('quicktime') || d.includes('m4a') || d === 'audio/mp4';
    }
    // Pure audio containers
    if (sniffed.startsWith('audio/')) {
        if (recordingType === 'video_only')
            return false;
        return d.startsWith('audio/') || d.includes(sniffed.split('/')[1] || '');
    }
    return false;
}
function validateInitParams(input) {
    const title = (input.title || '').trim();
    if (!title)
        return { ok: false, message: 'Thiếu tiêu đề recording' };
    if (title.length > exports.TELEPROMPTER_RECORDING_LIMITS.maxTitleLen) {
        return { ok: false, message: 'Tiêu đề quá dài' };
    }
    if (!exports.RECORDING_TYPES.has(input.recordingType)) {
        return { ok: false, message: 'recordingType không hợp lệ' };
    }
    const mime = (input.mimeType || '').split(';')[0]?.trim().toLowerCase() || '';
    if (!exports.ALLOWED_RECORDING_MIMES.has(mime)) {
        return { ok: false, message: 'MIME không được hỗ trợ' };
    }
    if (!Number.isFinite(input.size) || input.size <= 0) {
        return { ok: false, message: 'size không hợp lệ' };
    }
    if (input.size > maxRecordingFileBytes()) {
        return {
            ok: false,
            message: `File vượt giới hạn ${Math.round(maxRecordingFileBytes() / (1024 * 1024))}MB`,
        };
    }
    const duration = input.duration ?? 0;
    if (duration < 0 || duration > exports.TELEPROMPTER_RECORDING_LIMITS.maxDurationSec + 60) {
        return { ok: false, message: 'duration vượt giới hạn phiên (30 phút)' };
    }
    if (input.partSize != null) {
        if (input.partSize < exports.TELEPROMPTER_RECORDING_LIMITS.minPartSize ||
            input.partSize > exports.TELEPROMPTER_RECORDING_LIMITS.maxPartSize) {
            return { ok: false, message: 'partSize ngoài khoảng cho phép' };
        }
    }
    const parts = Math.ceil(input.size / (input.partSize || exports.TELEPROMPTER_RECORDING_LIMITS.defaultPartSize));
    if (parts > exports.TELEPROMPTER_RECORDING_LIMITS.maxParts) {
        return { ok: false, message: 'Số part quá lớn' };
    }
    return { ok: true };
}
function partEtag(partNumber, data) {
    return (0, crypto_1.createHash)('md5').update(String(partNumber)).update(data).digest('hex');
}
async function writePart(storageKey, partNumber, body) {
    if (!Number.isInteger(partNumber) ||
        partNumber < 1 ||
        partNumber > exports.TELEPROMPTER_RECORDING_LIMITS.maxParts) {
        throw new Error('partNumber invalid');
    }
    ensureRecordingDirs(storageKey);
    const partPath = (0, path_1.join)(partsDirFromKey(storageKey), String(partNumber));
    const tmp = `${partPath}.${(0, crypto_1.randomUUID)()}.tmp`;
    let buf;
    if (Buffer.isBuffer(body)) {
        buf = body;
        (0, fs_1.writeFileSync)(tmp, buf);
    }
    else {
        const chunks = [];
        for await (const chunk of body) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        buf = Buffer.concat(chunks);
        (0, fs_1.writeFileSync)(tmp, buf);
    }
    if (buf.length > exports.TELEPROMPTER_RECORDING_LIMITS.maxPartSize) {
        (0, fs_1.rmSync)(tmp, { force: true });
        throw new Error('Part quá lớn');
    }
    if (buf.length === 0) {
        (0, fs_1.rmSync)(tmp, { force: true });
        throw new Error('Part rỗng');
    }
    (0, fs_1.renameSync)(tmp, partPath);
    return { etag: partEtag(partNumber, buf), bytes: buf.length };
}
function listWrittenParts(storageKey) {
    const dir = partsDirFromKey(storageKey);
    if (!(0, fs_1.existsSync)(dir))
        return [];
    return (0, fs_1.readdirSync)(dir)
        .filter((n) => /^\d+$/.test(n))
        .map((n) => Number(n))
        .sort((a, b) => a - b);
}
async function assemblePartsAsync(storageKey, expectedParts) {
    // Reliability over streaming elegance for typical teleprompter sizes (≤500MB RAM host)
    return assembleParts(storageKey, expectedParts);
}
function assembleParts(storageKey, expectedParts) {
    // sync wrapper used in tests / small files
    const dest = absoluteFromKey(storageKey);
    ensureRecordingDirs(storageKey);
    const partsDir = partsDirFromKey(storageKey);
    const chunks = [];
    let total = 0;
    for (const n of expectedParts) {
        const p = (0, path_1.join)(partsDir, String(n));
        if (!(0, fs_1.existsSync)(p))
            throw new Error(`Thiếu part ${n}`);
        const data = (0, fs_1.readFileSync)(p);
        chunks.push(data);
        total += data.length;
    }
    (0, fs_1.writeFileSync)(dest, Buffer.concat(chunks));
    (0, fs_1.rmSync)(partsDir, { recursive: true, force: true });
    return total;
}
function objectSize(storageKey) {
    const abs = absoluteFromKey(storageKey);
    if (!(0, fs_1.existsSync)(abs))
        return 0;
    return (0, fs_1.statSync)(abs).size;
}
function openObjectStream(storageKey) {
    return (0, fs_1.createReadStream)(absoluteFromKey(storageKey));
}
function objectExists(storageKey) {
    try {
        return (0, fs_1.existsSync)(absoluteFromKey(storageKey));
    }
    catch {
        return false;
    }
}
function downloadSigningSecret() {
    return (process.env.TELEPROMPTER_DOWNLOAD_SECRET?.trim() ||
        process.env.JWT_SECRET?.trim() ||
        'dev-teleprompter-download-secret');
}
/** HMAC-signed download token — embeds id + exp, no storage path */
function signDownloadToken(payload, secret = downloadSigningSecret()) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = (0, crypto_1.createHmac)('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
}
function verifyDownloadToken(token, secret = downloadSigningSecret()) {
    const [body, sig] = token.split('.');
    if (!body || !sig)
        return null;
    const expected = (0, crypto_1.createHmac)('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !(0, crypto_1.timingSafeEqual)(a, b))
        return null;
    try {
        const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!data.recordingId || !data.organizationId || !data.userId || !data.exp)
            return null;
        if (Date.now() / 1000 > data.exp)
            return null;
        return data;
    }
    catch {
        return null;
    }
}
function sanitizeTitle(title) {
    return title.trim().slice(0, exports.TELEPROMPTER_RECORDING_LIMITS.maxTitleLen) || 'Recording';
}
function filenameFromTitle(title, mime) {
    const base = title
        .replace(/[^\w\u00C0-\u024F\s.-]+/g, '_')
        .trim()
        .slice(0, 80) || 'recording';
    return `${base}${extForMime(mime)}`;
}
