"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdPerformanceModule = void 0;
const common_1 = require("@nestjs/common");
const facebook_ads_module_1 = require("./facebook-ads/facebook-ads.module");
const google_ads_module_1 = require("./google-ads/google-ads.module");
/** Ad-performance: AdConnection, Meta/Google sync, normalized metrics */
let AdPerformanceModule = class AdPerformanceModule {
};
exports.AdPerformanceModule = AdPerformanceModule;
exports.AdPerformanceModule = AdPerformanceModule = __decorate([
    (0, common_1.Module)({
        imports: [facebook_ads_module_1.FacebookAdsModule, google_ads_module_1.GoogleAdsModule],
        exports: [facebook_ads_module_1.FacebookAdsModule, google_ads_module_1.GoogleAdsModule],
    })
], AdPerformanceModule);
