"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCKED_CONTENT_FIELDS = void 0;
exports.mapCampaignKindToEligibilityType = mapCampaignKindToEligibilityType;
exports.isCampaignContentEditable = isCampaignContentEditable;
exports.buildRecipientIdempotencyKey = buildRecipientIdempotencyKey;
function mapCampaignKindToEligibilityType(kind) {
    switch (kind) {
        case 'AUTOMATION':
            return 'automation';
        case 'BROADCAST':
            return 'broadcast';
        case 'TRANSACTIONAL':
            return 'transactional';
        case 'TEMPLATE':
            return 'template';
        default:
            return 'broadcast';
    }
}
function isCampaignContentEditable(status, startedAt) {
    if (startedAt)
        return false;
    return status === 'DRAFT' || status === 'SCHEDULED';
}
exports.LOCKED_CONTENT_FIELDS = [
    'segmentConfig',
    'variables',
    'messageTemplateId',
    'channelConnectionId',
    'integrationId',
    'channel',
    'campaignType',
];
function buildRecipientIdempotencyKey(campaignId, identityId) {
    return `mc-${campaignId}-${identityId}`;
}
