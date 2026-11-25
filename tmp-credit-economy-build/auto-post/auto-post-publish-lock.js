"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoPostPublishLockKey = autoPostPublishLockKey;
exports.acquireAutoPostPublishLock = acquireAutoPostPublishLock;
exports.releaseAutoPostPublishLock = releaseAutoPostPublishLock;
/**
 * Lock publish: key bắt buộc gồm organizationId + postId.
 * Ownership token — chỉ owner mới release (Lua). TTL chống deadlock khi crash.
 */
function autoPostPublishLockKey(organizationId, postId) {
    return `auto-post:lock:publish:${organizationId}:${postId}`;
}
async function acquireAutoPostPublishLock(redis, organizationId, postId, owner, ttlMs = 120_000) {
    const key = autoPostPublishLockKey(organizationId, postId);
    const res = await redis.set(key, owner, 'PX', ttlMs, 'NX');
    return res === 'OK' ? { ok: true, key } : { ok: false, key };
}
async function releaseAutoPostPublishLock(redis, key, owner) {
    const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
    const n = (await redis.eval(script, 1, key, owner));
    return Number(n) === 1;
}
