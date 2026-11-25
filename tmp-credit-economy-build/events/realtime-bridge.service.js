"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RealtimeBridgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeBridgeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const shared_1 = require("@marketingspa/shared");
const events_gateway_1 = require("./events.gateway");
/** Subscribe Redis pub/sub from worker and forward to Socket.IO */
let RealtimeBridgeService = RealtimeBridgeService_1 = class RealtimeBridgeService {
    config;
    events;
    logger = new common_1.Logger(RealtimeBridgeService_1.name);
    subscriber = null;
    connecting = false;
    reconnectTimer = null;
    subscribed = false;
    lastError = null;
    constructor(config, events) {
        this.config = config;
        this.events = events;
    }
    onModuleInit() {
        void this.connectSubscriber();
    }
    isHealthy() {
        return Boolean(this.subscriber && this.subscribed && this.subscriber.status === 'ready');
    }
    getStatus() {
        return {
            connected: this.isHealthy(),
            status: this.subscriber?.status ?? 'disconnected',
            subscribed: this.subscribed,
            lastError: this.lastError,
            channel: shared_1.REALTIME_CHANNEL,
        };
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            void this.connectSubscriber();
        }, 10_000);
    }
    async connectSubscriber() {
        if (this.connecting)
            return;
        this.connecting = true;
        this.subscribed = false;
        const redisUrl = this.config.get('REDIS_URL', 'redis://localhost:6379');
        if (this.subscriber) {
            try {
                this.subscriber.removeAllListeners();
                await this.subscriber.quit();
            }
            catch {
                // ignore cleanup errors
            }
            this.subscriber = null;
        }
        const subscriber = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: null,
            connectTimeout: 5_000,
            // Tránh lỗi "already connecting/connected" khi gọi connect() lần 2
            lazyConnect: true,
            enableOfflineQueue: false,
            retryStrategy: () => null,
        });
        this.subscriber = subscriber;
        subscriber.on('error', (err) => {
            this.lastError = err.message;
            this.logger.warn(`Redis subscriber error: ${err.message}`);
        });
        subscriber.on('end', () => {
            this.subscribed = false;
            this.scheduleReconnect();
        });
        subscriber.on('message', (channel, message) => {
            if (channel !== shared_1.REALTIME_CHANNEL)
                return;
            try {
                const { organizationId, event, payload } = JSON.parse(message);
                if (!organizationId || !event)
                    return;
                this.events.emitToOrg(organizationId, event, payload);
            }
            catch (err) {
                this.logger.error('Failed to parse realtime message', err);
            }
        });
        try {
            if (subscriber.status === 'wait') {
                await subscriber.connect();
            }
            else if (subscriber.status === 'connecting') {
                await new Promise((resolve, reject) => {
                    const onReady = () => {
                        cleanup();
                        resolve();
                    };
                    const onError = (err) => {
                        cleanup();
                        reject(err);
                    };
                    const cleanup = () => {
                        subscriber.off('ready', onReady);
                        subscriber.off('error', onError);
                    };
                    subscriber.once('ready', onReady);
                    subscriber.once('error', onError);
                });
            }
            await subscriber.subscribe(shared_1.REALTIME_CHANNEL);
            this.subscribed = true;
            this.lastError = null;
            this.logger.log(`Subscribed to ${shared_1.REALTIME_CHANNEL}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.lastError = message;
            this.subscribed = false;
            this.logger.warn(`Redis unavailable — realtime bridge paused (API vẫn chạy bình thường): ${message}`);
            this.scheduleReconnect();
        }
        finally {
            this.connecting = false;
        }
    }
    async onModuleDestroy() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.subscriber) {
            try {
                this.subscriber.removeAllListeners();
                await this.subscriber.quit();
            }
            catch {
                /* ignore */
            }
            this.subscriber = null;
        }
    }
};
exports.RealtimeBridgeService = RealtimeBridgeService;
exports.RealtimeBridgeService = RealtimeBridgeService = RealtimeBridgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        events_gateway_1.EventsGateway])
], RealtimeBridgeService);
