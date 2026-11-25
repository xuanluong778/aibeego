"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentMarketingModule = void 0;
const common_1 = require("@nestjs/common");
const content_marketing_controller_1 = require("./content-marketing.controller");
const content_marketing_service_1 = require("./content-marketing.service");
const content_industry_service_1 = require("./content-industry.service");
const opinion_voice_profile_service_1 = require("./opinion-voice-profile.service");
const teleprompter_source_service_1 = require("./teleprompter-source.service");
const ad_url_analyze_service_1 = require("./ad-url-analyze.service");
const prisma_module_1 = require("../prisma/prisma.module");
let ContentMarketingModule = class ContentMarketingModule {
};
exports.ContentMarketingModule = ContentMarketingModule;
exports.ContentMarketingModule = ContentMarketingModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [content_marketing_controller_1.ContentMarketingController],
        providers: [
            content_marketing_service_1.ContentMarketingService,
            content_industry_service_1.ContentIndustryService,
            opinion_voice_profile_service_1.OpinionVoiceProfileService,
            teleprompter_source_service_1.TeleprompterSourceService,
            ad_url_analyze_service_1.AdUrlAnalyzeService,
        ],
        exports: [content_industry_service_1.ContentIndustryService, opinion_voice_profile_service_1.OpinionVoiceProfileService, teleprompter_source_service_1.TeleprompterSourceService],
    })
], ContentMarketingModule);
