"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_INTEGRATION_PROVIDERS = void 0;
exports.createConnector = createConnector;
exports.isAdsIntegrationProvider = isAdsIntegrationProvider;
const database_1 = require("@marketingspa/database");
const mock_connectors_1 = require("./mock-connectors");
/**
 * Ads (META_ADS / GOOGLE_ADS) mock connectors are DEPRECATED.
 * Credential + sync ownership lives on AdConnection / ad-performance OAuth.
 */
function createConnector(provider) {
    if (isAdsIntegrationProvider(provider)) {
        throw new Error('DEPRECATED: Ads mock connector disabled — use AdConnection / OAuth via /ads (ad-performance)');
    }
    switch (provider) {
        case database_1.IntegrationProvider.ZALO_OA:
            return new mock_connectors_1.ZaloConnector();
        case database_1.IntegrationProvider.SMS:
            return new mock_connectors_1.SmsConnector();
        case database_1.IntegrationProvider.EMAIL:
            return new mock_connectors_1.EmailConnector();
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}
exports.ALL_INTEGRATION_PROVIDERS = [
    database_1.IntegrationProvider.META_ADS,
    database_1.IntegrationProvider.GOOGLE_ADS,
    database_1.IntegrationProvider.ZALO_OA,
    database_1.IntegrationProvider.SMS,
    database_1.IntegrationProvider.EMAIL,
];
function isAdsIntegrationProvider(provider) {
    return (provider === database_1.IntegrationProvider.META_ADS || provider === database_1.IntegrationProvider.GOOGLE_ADS);
}
