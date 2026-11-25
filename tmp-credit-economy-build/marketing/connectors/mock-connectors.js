"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailConnector = exports.SmsConnector = exports.ZaloConnector = exports.GoogleAdsConnector = exports.MetaAdsConnector = void 0;
const database_1 = require("@marketingspa/database");
function mockDelay(ms = 120) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function hasCredentials(credentials) {
    return Object.values(credentials).some((v) => v?.trim());
}
class BaseMockConnector {
    async connect(credentials) {
        await mockDelay();
        const ok = hasCredentials(credentials);
        return {
            success: ok,
            message: ok
                ? `[MOCK] ${this.provider} connected (placeholder)`
                : `[MOCK] Missing credentials for ${this.provider}`,
            externalAccountId: ok ? `mock-${this.provider.toLowerCase()}-001` : undefined,
        };
    }
    async testConnection() {
        await mockDelay(80);
        return {
            success: true,
            message: `[MOCK] ${this.provider} test connection OK (placeholder)`,
            latencyMs: 80,
        };
    }
    async fetchCampaigns() {
        await mockDelay();
        return [
            {
                id: 'mock-camp-1',
                name: `Demo campaign (${this.provider})`,
                status: 'ACTIVE',
                spend: 1500000,
                impressions: 12000,
            },
        ];
    }
    async fetchDailyStats(from, to) {
        await mockDelay();
        const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
        return Array.from({ length: Math.min(days, 7) }, (_, i) => ({
            date: new Date(from.getTime() + i * 86400000).toISOString().slice(0, 10),
            spend: 200000 + i * 50000,
            impressions: 1000 + i * 200,
            clicks: 50 + i * 10,
            conversions: 3 + i,
        }));
    }
    async sendMessage(payload) {
        await mockDelay();
        return {
            success: true,
            messageId: `mock-msg-${Date.now()}`,
            message: `[MOCK] Message queued to ${payload.to}`,
        };
    }
}
class MetaAdsConnector extends BaseMockConnector {
    provider = database_1.IntegrationProvider.META_ADS;
}
exports.MetaAdsConnector = MetaAdsConnector;
class GoogleAdsConnector extends BaseMockConnector {
    provider = database_1.IntegrationProvider.GOOGLE_ADS;
}
exports.GoogleAdsConnector = GoogleAdsConnector;
class ZaloConnector extends BaseMockConnector {
    provider = database_1.IntegrationProvider.ZALO_OA;
}
exports.ZaloConnector = ZaloConnector;
class SmsConnector extends BaseMockConnector {
    provider = database_1.IntegrationProvider.SMS;
}
exports.SmsConnector = SmsConnector;
class EmailConnector extends BaseMockConnector {
    provider = database_1.IntegrationProvider.EMAIL;
}
exports.EmailConnector = EmailConnector;
