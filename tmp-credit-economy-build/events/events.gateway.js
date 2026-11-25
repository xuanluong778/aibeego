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
var EventsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const socket_io_1 = require("socket.io");
/** Socket.IO gateway — realtime theo organization room (JWT bắt buộc) */
let EventsGateway = EventsGateway_1 = class EventsGateway {
    jwt;
    config;
    logger = new common_1.Logger(EventsGateway_1.name);
    server;
    constructor(jwt, config) {
        this.jwt = jwt;
        this.config = config;
    }
    async handleConnection(client) {
        const token = client.handshake.auth?.token ??
            client.handshake.query?.token;
        if (!token) {
            client.disconnect(true);
            return;
        }
        try {
            const payload = await this.jwt.verifyAsync(token, {
                secret: this.config.get('JWT_SECRET'),
            });
            if (!payload.organizationId) {
                client.disconnect(true);
                return;
            }
            client.data.userId = payload.sub;
            client.data.organizationId = payload.organizationId;
            client.join(`org:${payload.organizationId}`);
        }
        catch (err) {
            this.logger.debug(`Socket auth failed: ${err instanceof Error ? err.message : err}`);
            client.disconnect(true);
        }
    }
    handleDisconnect(_client) {
        // Room cleanup tự động bởi Socket.IO
    }
    emitToOrg(organizationId, event, payload) {
        this.server.to(`org:${organizationId}`).emit(event, payload);
    }
    broadcastToOrg(organizationId, event, payload) {
        this.emitToOrg(organizationId, event, payload);
    }
    broadcastCampaignUpdate(organizationId, payload) {
        this.broadcastToOrg(organizationId, 'campaign:update', payload);
    }
    broadcastLeadNew(organizationId, payload) {
        this.broadcastToOrg(organizationId, 'lead:new', payload);
    }
    broadcastAppointmentNew(organizationId, payload) {
        this.broadcastToOrg(organizationId, 'appointment:new', payload);
    }
    broadcastLeadStaleAlert(organizationId, payload) {
        this.broadcastToOrg(organizationId, 'lead:stale-alert', payload);
    }
    broadcastLeadStatusChanged(organizationId, payload) {
        this.broadcastToOrg(organizationId, 'lead:status-changed', payload);
    }
    broadcastChatbotMessageNew(organizationId, payload) {
        this.broadcastToOrg(organizationId, 'chatbot:message-new', payload);
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
exports.EventsGateway = EventsGateway = EventsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: [
                process.env.NEXT_PUBLIC_APP_URL,
                process.env.APP_URL,
                'https://aibeego.com',
                'https://www.aibeego.com',
                'https://marketingautoaz.com',
                'https://www.marketingautoaz.com',
                'http://localhost:3000',
                'http://127.0.0.1:3002',
            ].filter(Boolean),
            credentials: true,
        },
        namespace: '/events',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], EventsGateway);
