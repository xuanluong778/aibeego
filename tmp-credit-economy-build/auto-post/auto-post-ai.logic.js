"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAutoPostContent = generateAutoPostContent;
exports.rewriteAutoPostContent = rewriteAutoPostContent;
const auto_post_config_1 = require("./auto-post-config");
function parseAiJson(raw) {
    const trimmed = raw.trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return { caption: trimmed, hashtags: [], cta: '' };
    }
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        const hashtags = Array.isArray(parsed.hashtags)
            ? parsed.hashtags
            : typeof parsed.hashtags === 'string'
                ? parsed.hashtags.split(/\s+/).filter(Boolean)
                : [];
        return {
            caption: parsed.caption?.trim() ?? trimmed,
            hashtags,
            cta: parsed.cta?.trim() ?? '',
        };
    }
    catch {
        return { caption: trimmed, hashtags: [], cta: '' };
    }
}
async function generateAutoPostContent(openai, input) {
    const prompt = (0, auto_post_config_1.buildAutoPostPrompt)(input);
    const raw = await openai.chatCompletion({
        messages: [
            {
                role: 'system',
                content: 'Bạn viết content marketing spa cho Facebook. Luôn trả JSON hợp lệ, không giải thích thêm.',
            },
            { role: 'user', content: prompt },
        ],
        temperature: 0.85,
        maxTokens: 1800,
    });
    return parseAiJson(raw);
}
async function rewriteAutoPostContent(openai, mode, caption, cta) {
    const prompt = (0, auto_post_config_1.buildAutoPostRewritePrompt)(mode, caption, cta);
    const raw = await openai.chatCompletion({
        messages: [
            {
                role: 'system',
                content: 'Trả JSON hợp lệ: {"caption","hashtags","cta"}. Không markdown heading.',
            },
            { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        maxTokens: 1600,
    });
    return parseAiJson(raw);
}
