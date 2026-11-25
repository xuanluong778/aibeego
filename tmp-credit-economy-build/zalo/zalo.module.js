"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZaloModule = void 0;
const common_1 = require("@nestjs/common");
const messaging_module_1 = require("../messaging/messaging.module");
const zalo_connections_controller_1 = require("./zalo-connections.controller");
const zalo_connections_service_1 = require("./zalo-connections.service");
const zalo_health_controller_1 = require("./zalo-health.controller");
let ZaloModule = class ZaloModule {
};
exports.ZaloModule = ZaloModule;
exports.ZaloModule = ZaloModule = __decorate([
    (0, common_1.Module)({
        imports: [messaging_module_1.MessagingModule],
        controllers: [zalo_connections_controller_1.ZaloConnectionsController, zalo_health_controller_1.ZaloHealthController],
        providers: [zalo_connections_service_1.ZaloConnectionsService],
        exports: [zalo_connections_service_1.ZaloConnectionsService],
    })
], ZaloModule);
