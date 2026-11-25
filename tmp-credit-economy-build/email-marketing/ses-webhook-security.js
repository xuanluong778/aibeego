"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expectedSnsTopicArn = void 0;
exports.authenticateSesWebhook = authenticateSesWebhook;
const crypto_1 = require("crypto");
const shared_1 = require("@marketingspa/shared");
const sns_test_signing_1 = require("@marketingspa/shared/dist/sns-test-signing");
const ses_webhook_util_1 = require("./ses-webhook.util");
Object.defineProperty(exports, "expectedSnsTopicArn", { enumerable: true, get: function () { return ses_webhook_util_1.expectedSnsTopicArn; } });
function parseEnvelope(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        if (typeof input === 'string') {
            try {
                const parsed = JSON.parse(input);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
                }
            }
            catch {
                return null;
            }
        }
        return null;
    }
    return input;
}
function verifyTestWebhookHmac(rawBody, testSignature) {
    const key = (0, sns_test_signing_1.snsTestSigningKey)();
    if (!key || !rawBody || !testSignature)
        return false;
    const expected = (0, crypto_1.createHash)('sha256').update(`${key}:${rawBody}`).digest('hex');
    try {
        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(testSignature, 'utf8');
        return a.length === b.length && (0, crypto_1.timingSafeEqual)(a, b);
    }
    catch {
        return false;
    }
}
/** Authenticate SNS webhook: signature + topic ARN (fail-closed). */
async function authenticateSesWebhook(input, opts) {
    const envelope = parseEnvelope(input);
    if (!envelope)
        return { ok: false, reason: 'invalid_payload', statusCode: 400 };
    const expectedTopic = (0, ses_webhook_util_1.expectedSnsTopicArn)();
    if (!expectedTopic) {
        return { ok: false, reason: 'missing_topic_arn', statusCode: 403 };
    }
    const topicArn = (0, ses_webhook_util_1.snsTopicArnFrom)(envelope);
    if (!topicArn || topicArn !== expectedTopic) {
        return { ok: false, reason: 'topic_mismatch', statusCode: 403 };
    }
    const rawBody = opts?.rawBody ??
        (typeof input === 'string' ? input : JSON.stringify(input));
    const testKey = (0, sns_test_signing_1.snsTestSigningKey)();
    const testSig = opts?.testSignatureHeader;
    const testAuthOk = testKey && testSig ? verifyTestWebhookHmac(rawBody, testSig) : false;
    if (!testAuthOk) {
        const verified = await (0, shared_1.verifyAmazonSnsMessage)(envelope);
        if (!verified.ok) {
            return { ok: false, reason: verified.reason, statusCode: 403 };
        }
    }
    const event = (0, ses_webhook_util_1.parseSesWebhookPayload)(envelope);
    if (event.kind === 'sns_confirm') {
        if (!event.subscribeUrl || !(0, ses_webhook_util_1.isAllowedSnsSubscribeUrl)(event.subscribeUrl)) {
            return { ok: false, reason: 'invalid_subscribe_url', statusCode: 403 };
        }
    }
    return { ok: true, envelope, event };
}
