"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSesWebhookPayload = parseSesWebhookPayload;
exports.isAllowedSnsSubscribeUrl = isAllowedSnsSubscribeUrl;
exports.expectedSnsTopicMatches = expectedSnsTopicMatches;
exports.expectedSnsTopicArn = expectedSnsTopicArn;
exports.snsTopicArnFrom = snsTopicArnFrom;
function parseJson(value) {
    if (!value)
        return null;
    if (typeof value === 'object' && !Array.isArray(value))
        return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
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
function tagValues(tags, key) {
    if (!tags)
        return [];
    const match = Object.entries(tags).find(([k]) => k.toLowerCase() === key.toLowerCase());
    return [...new Set((match?.[1] ?? []).map((v) => String(v).trim()).filter(Boolean))];
}
function extractEmail(raw) {
    const angle = raw.match(/<([^>]+)>/);
    const value = (angle?.[1] || raw).trim().toLowerCase();
    return value.includes('@') ? value : null;
}
function normalizeEventEmails(values, fallback = []) {
    const out = [];
    for (const raw of [...(values ?? []), ...fallback]) {
        if (!raw)
            continue;
        const email = extractEmail(raw);
        if (email)
            out.push(email);
    }
    return [...new Set(out)];
}
function parseSesWebhookPayload(input) {
    const root = parseJson(input);
    if (!root)
        return { kind: 'ignored' };
    const type = String(root.Type || '');
    if (type === 'SubscriptionConfirmation') {
        return {
            kind: 'sns_confirm',
            subscribeUrl: typeof root.SubscribeURL === 'string' ? root.SubscribeURL : undefined,
            rawType: type,
        };
    }
    if (type === 'UnsubscribeConfirmation') {
        return { kind: 'ignored', rawType: type };
    }
    const inner = type === 'Notification' ? parseJson(root.Message) : root;
    if (!inner)
        return { kind: 'ignored', rawType: type || 'unknown' };
    const envelope = inner;
    const eventType = String(envelope.eventType || envelope.notificationType || '').toLowerCase();
    const messageId = envelope.mail?.messageId;
    const recipientIds = tagValues(envelope.mail?.tags, 'recipientId');
    const campaignIds = tagValues(envelope.mail?.tags, 'campaignId');
    const dest = envelope.mail?.destination ?? [];
    const base = { messageId, recipientIds, campaignIds, rawType: eventType };
    if (eventType === 'send') {
        return { kind: 'send', ...base, emails: normalizeEventEmails(dest) };
    }
    if (eventType === 'delivery') {
        return {
            kind: 'delivery',
            ...base,
            emails: normalizeEventEmails(envelope.delivery?.recipients, dest),
        };
    }
    if (eventType === 'open') {
        return { kind: 'open', ...base, emails: normalizeEventEmails(dest) };
    }
    if (eventType === 'click') {
        return {
            kind: 'click',
            ...base,
            emails: normalizeEventEmails(dest),
            link: envelope.click?.link,
        };
    }
    if (eventType === 'bounce') {
        return {
            kind: 'bounce',
            ...base,
            emails: normalizeEventEmails(envelope.bounce?.bouncedRecipients?.map((r) => r.emailAddress), dest),
            permanent: (envelope.bounce?.bounceType || '').toLowerCase() !== 'transient',
        };
    }
    if (eventType === 'complaint') {
        return {
            kind: 'complaint',
            ...base,
            emails: normalizeEventEmails(envelope.complaint?.complainedRecipients?.map((r) => r.emailAddress), dest),
            permanent: true,
        };
    }
    if (eventType === 'subscription' || eventType === 'unsubscribe') {
        return {
            kind: 'unsubscribe',
            ...base,
            emails: normalizeEventEmails(dest),
            permanent: true,
        };
    }
    return { kind: 'ignored', messageId, rawType: eventType || type };
}
function isAllowedSnsSubscribeUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:')
            return false;
        if (parsed.username || parsed.password)
            return false;
        if (parsed.port && parsed.port !== '443')
            return false;
        const host = parsed.hostname.toLowerCase();
        return host.endsWith('.amazonaws.com') && host.startsWith('sns.');
    }
    catch {
        return false;
    }
}
function expectedSnsTopicMatches(topicArn) {
    const expected = expectedSnsTopicArn();
    if (!expected)
        return false;
    return Boolean(topicArn && topicArn === expected);
}
/** Required SNS topic ARN — fail-closed when unset. */
function expectedSnsTopicArn() {
    return (process.env.SES_SNS_TOPIC_ARN || '').trim();
}
function snsTopicArnFrom(input) {
    const root = parseJson(input);
    return typeof root?.TopicArn === 'string' ? root.TopicArn : undefined;
}
