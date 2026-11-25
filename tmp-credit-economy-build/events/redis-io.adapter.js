"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = __importDefault(require("ioredis"));
/**
 * Redis adapter so Socket.IO rooms work across PM2 cluster API instances.
 * Sticky sessions are not required when this adapter is connected.
 */
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    adapterConstructor = null;
    pubClient = null;
    subClient = null;
    enabled = false;
    constructor(app) {
        super(app);
    }
    async connectToRedis(redisUrl) {
        this.pubClient = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            enableOfflineQueue: false,
        });
        this.subClient = this.pubClient.duplicate();
        await Promise.all([
            this.pubClient.status === 'wait' ? this.pubClient.connect() : Promise.resolve(),
            this.subClient.status === 'wait' ? this.subClient.connect() : Promise.resolve(),
        ]);
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(this.pubClient, this.subClient);
        this.enabled = true;
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }
    async disconnectRedis() {
        await Promise.allSettled([this.pubClient?.quit(), this.subClient?.quit()]);
        this.pubClient = null;
        this.subClient = null;
        this.enabled = false;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
