"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FanpageDetailsRedisCache = void 0;
const auto_post_facebook_page_details_types_1 = require("./auto-post-facebook-page-details.types");
const auto_post_facebook_page_details_logic_1 = require("./auto-post-facebook-page-details.logic");
const meta_redis_cache_1 = require("./meta-redis-cache");
/** TTL cache chính 4 phút; stale giữ 24h chỉ cho UI metadata/posts — không dùng cho publish auth. */
const FRESH_TTL_SEC = Math.ceil(auto_post_facebook_page_details_types_1.FANPAGE_DETAILS_CACHE_TTL_MS / 1000);
const STALE_TTL_SEC = 24 * 60 * 60;
function scope(organizationId, fanpageId) {
    return (0, auto_post_facebook_page_details_logic_1.fanpageDetailsCacheKey)(organizationId, fanpageId);
}
function freshKey(organizationId, fanpageId) {
    return `meta:cache:${auto_post_facebook_page_details_types_1.META_CACHE_OP_DETAILS}:${scope(organizationId, fanpageId)}`;
}
function staleKey(organizationId, fanpageId) {
    return `meta:cache:${auto_post_facebook_page_details_types_1.META_CACHE_OP_DETAILS}:stale:${scope(organizationId, fanpageId)}`;
}
function lockKey(organizationId, fanpageId) {
    return `meta:lock:${auto_post_facebook_page_details_types_1.META_CACHE_OP_DETAILS}:${scope(organizationId, fanpageId)}`;
}
function resultKey(organizationId, fanpageId) {
    return `meta:lock:${auto_post_facebook_page_details_types_1.META_CACHE_OP_DETAILS}:result:${scope(organizationId, fanpageId)}`;
}
/** Index fanpage ids đã cache theo org — để invalidate cả org khi reconnect/disconnect. */
function orgIndexKey(organizationId) {
    return `meta:cache:${auto_post_facebook_page_details_types_1.META_CACHE_OP_DETAILS}:index:${organizationId}`;
}
const memoryFresh = new Map();
const memoryStale = new Map();
class FanpageDetailsRedisCache {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async getFresh(organizationId, fanpageId) {
        const mk = scope(organizationId, fanpageId);
        const mem = memoryFresh.get(mk);
        if (mem && Date.now() < mem.expiresAt) {
            return {
                ...mem.value,
                cached: true,
                stale: false,
                dataSource: 'cache',
            };
        }
        const hit = await (0, meta_redis_cache_1.redisCacheGet)(this.redis, freshKey(organizationId, fanpageId));
        if (hit) {
            memoryFresh.set(mk, {
                expiresAt: Date.now() + auto_post_facebook_page_details_types_1.FANPAGE_DETAILS_CACHE_TTL_MS,
                value: { ...hit, cached: false },
            });
            return { ...hit, cached: true, stale: false, dataSource: 'cache' };
        }
        return null;
    }
    async getStale(organizationId, fanpageId) {
        const mk = scope(organizationId, fanpageId);
        const mem = memoryStale.get(mk);
        if (mem) {
            return { ...mem, cached: true, stale: true, dataSource: 'stale' };
        }
        const hit = await (0, meta_redis_cache_1.redisCacheGet)(this.redis, staleKey(organizationId, fanpageId));
        return hit ? { ...hit, cached: true, stale: true, dataSource: 'stale' } : null;
    }
    async set(organizationId, fanpageId, value) {
        const stored = {
            ...value,
            cached: false,
            stale: false,
            dataSource: 'live',
        };
        const mk = scope(organizationId, fanpageId);
        memoryFresh.set(mk, {
            expiresAt: Date.now() + auto_post_facebook_page_details_types_1.FANPAGE_DETAILS_CACHE_TTL_MS,
            value: stored,
        });
        memoryStale.set(mk, stored);
        await (0, meta_redis_cache_1.redisCacheSet)(this.redis, freshKey(organizationId, fanpageId), stored, FRESH_TTL_SEC);
        await (0, meta_redis_cache_1.redisCacheSet)(this.redis, staleKey(organizationId, fanpageId), stored, STALE_TTL_SEC);
        if (this.redis) {
            try {
                await this.redis.sadd(orgIndexKey(organizationId), fanpageId);
                await this.redis.expire(orgIndexKey(organizationId), STALE_TTL_SEC);
            }
            catch {
                /* ignore */
            }
        }
    }
    /** Xóa fresh (và optionally stale) cho 1 Fanpage. */
    async invalidate(organizationId, fanpageId, opts) {
        const mk = scope(organizationId, fanpageId);
        memoryFresh.delete(mk);
        const keys = [freshKey(organizationId, fanpageId)];
        if (opts?.dropStale) {
            memoryStale.delete(mk);
            keys.push(staleKey(organizationId, fanpageId));
        }
        await (0, meta_redis_cache_1.redisCacheDel)(this.redis, ...keys);
    }
    /** Reconnect / đổi quyền / disconnect — drop fresh+stale toàn org. */
    async invalidateOrganization(organizationId) {
        const ids = new Set();
        if (this.redis) {
            try {
                const members = await this.redis.smembers(orgIndexKey(organizationId));
                for (const id of members)
                    ids.add(id);
            }
            catch {
                /* ignore */
            }
        }
        for (const [mk] of memoryFresh) {
            if (mk.startsWith(`${organizationId}:`)) {
                ids.add(mk.slice(organizationId.length + 1));
            }
        }
        for (const id of ids) {
            await this.invalidate(organizationId, id, { dropStale: true });
        }
        if (this.redis) {
            await (0, meta_redis_cache_1.redisCacheDel)(this.redis, orgIndexKey(organizationId));
        }
    }
    async withSingleFlight(organizationId, fanpageId, fn, onPrevented) {
        const { value, leader } = await (0, meta_redis_cache_1.withRedisSingleFlight)(this.redis, lockKey(organizationId, fanpageId), {
            ttlMs: 45_000,
            waitMs: 15_000,
            resultKey: resultKey(organizationId, fanpageId),
            resultTtlSec: 45,
        }, fn);
        if (!leader && onPrevented)
            onPrevented();
        return value;
    }
}
exports.FanpageDetailsRedisCache = FanpageDetailsRedisCache;
