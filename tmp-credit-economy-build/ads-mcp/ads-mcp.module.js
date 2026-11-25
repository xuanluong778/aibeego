"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdsMcpModule = void 0;
const common_1 = require("@nestjs/common");
const ad_performance_module_1 = require("../ad-performance/ad-performance.module");
const ads_mcp_gateway_1 = require("./ads-mcp.gateway");
/**
 * Internal Ads MCP — chỉ inject trong Nest (không đăng ký HTTP controller public).
 * AI / ai-ads-manager đọc metrics qua AdsMcpGateway; không gọi Meta/Google API.
 */
let AdsMcpModule = class AdsMcpModule {
};
exports.AdsMcpModule = AdsMcpModule;
exports.AdsMcpModule = AdsMcpModule = __decorate([
    (0, common_1.Module)({
        imports: [ad_performance_module_1.AdPerformanceModule],
        providers: [ads_mcp_gateway_1.AdsMcpGateway],
        exports: [ads_mcp_gateway_1.AdsMcpGateway],
    })
], AdsMcpModule);
