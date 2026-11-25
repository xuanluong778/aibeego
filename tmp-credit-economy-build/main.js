"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const fs_1 = require("fs");
const path_1 = require("path");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("./app.module");
const sentry_1 = require("./sentry");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const chatbot_widget_1 = require("./chatbot-cskh/utils/chatbot-widget");
const request_id_middleware_1 = require("./common/middleware/request-id.middleware");
const authenticated_uploads_middleware_1 = require("./common/middleware/authenticated-uploads.middleware");
const cors_origins_1 = require("./common/utils/cors-origins");
async function bootstrap() {
    (0, sentry_1.initSentry)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        rawBody: true,
    });
    // Đảm bảo rawBody có cho verify X-Hub-Signature-256 (Meta webhook)
    app.useBodyParser('json', {
        verify: (req, _res, buf) => {
            if (Buffer.isBuffer(buf) && buf.length) {
                req.rawBody = buf;
            }
        },
    });
    // Meta deauthorize / data-deletion gửi application/x-www-form-urlencoded
    app.useBodyParser('urlencoded', { extended: true });
    app.setGlobalPrefix('api/v1');
    // Probe aliases without version prefix (k8s / nginx). Logic lives in HealthService.
    app.use((0, cookie_parser_1.default)());
    app.use((req, res, next) => {
        const { randomUUID } = require('crypto');
        const incoming = req.headers[request_id_middleware_1.REQUEST_ID_HEADER.toLowerCase()];
        const requestId = (typeof incoming === 'string' && incoming.trim()) || randomUUID();
        req.requestId = requestId;
        res.setHeader(request_id_middleware_1.REQUEST_ID_HEADER, requestId);
        next();
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new http_exception_filter_1.GlobalExceptionFilter());
    const uploadsDir = (0, path_1.join)(process.cwd(), 'uploads');
    if (!(0, fs_1.existsSync)(uploadsDir)) {
        (0, fs_1.mkdirSync)(uploadsDir, { recursive: true });
    }
    // Private uploads — JWT required (no public useStaticAssets)
    const jwt = app.get(jwt_1.JwtService);
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('/uploads/*', (0, authenticated_uploads_middleware_1.createAuthenticatedUploadsHandler)({ uploadsDir, jwt }));
    const corsOrigins = (0, cors_origins_1.resolveCorsOrigins)(process.env);
    app.enableCors({
        origin: (origin, callback) => {
            // Same-origin / curl / server-to-server (no Origin header)
            if (!origin) {
                callback(null, true);
                return;
            }
            if ((0, cors_origins_1.isCorsOriginAllowed)(origin, corsOrigins)) {
                callback(null, true);
                return;
            }
            // Deny without throwing — throwing makes Express return 500 on preflight.
            callback(null, false);
        },
        credentials: true,
    });
    const widgetPath = (0, chatbot_widget_1.resolveChatbotWidgetPath)();
    if (widgetPath) {
        expressApp.get('/chatbot/widget.js', (_req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=300');
            res.sendFile(widgetPath);
        });
        expressApp.options('/chatbot/widget.js', (_req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.status(204).end();
        });
    }
    else {
        console.warn('⚠️  chatbot/widget.js not found — embed script will 404 until file is present');
    }
    const config = app.get(config_1.ConfigService);
    const { assertEncryptionKeyConfigured } = await Promise.resolve().then(() => __importStar(require('./common/utils/assert-encryption-key')));
    assertEncryptionKeyConfigured(config.get('ENCRYPTION_KEY'));
    const redisUrl = config.get('REDIS_URL') || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    if (process.env.SOCKET_REDIS_ADAPTER !== '0') {
        try {
            const { RedisIoAdapter } = await Promise.resolve().then(() => __importStar(require('./events/redis-io.adapter')));
            const redisIoAdapter = new RedisIoAdapter(app);
            await redisIoAdapter.connectToRedis(redisUrl);
            app.useWebSocketAdapter(redisIoAdapter);
            console.log('🔌 Socket.IO Redis adapter enabled');
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`⚠️  Socket.IO Redis adapter unavailable (${message}) — single-instance sockets only`);
        }
    }
    // Fail-fast OAuth Auto Post: App ID / config_id / redirect Ai Bee Go
    const { assertAutoPostMetaOAuthConfig } = await Promise.resolve().then(() => __importStar(require('./auto-post/assert-auto-post-meta-oauth')));
    assertAutoPostMetaOAuthConfig((k) => config.get(k) ?? process.env[k]);
    const port = config.get('PORT', 4000);
    const host = config.get('HOST', '127.0.0.1');
    const { HealthService } = await Promise.resolve().then(() => __importStar(require('./health/health.service')));
    const healthService = app.get(HealthService);
    expressApp.get('/health', (_req, res) => {
        res.json(healthService.liveness());
    });
    expressApp.get('/ready', async (_req, res) => {
        const result = await healthService.readiness();
        res.status(result.ok ? 200 : 503).json(result.body);
    });
    app.enableShutdownHooks();
    await app.listen(port, host);
    console.log(`🚀 API running on http://${host}:${port}/api/v1`);
    if (widgetPath) {
        console.log(`💬 Chatbot widget: http://${host}:${port}/chatbot/widget.js`);
    }
}
bootstrap();
