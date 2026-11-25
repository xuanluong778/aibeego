"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOLD_MAY_TAO_PROMPT_BLOCK = exports.BOLD_MAY_TAO_TONE_DESCRIPTION = exports.BOLD_MAY_TAO_TONE_LABEL = exports.MAY_TAO_INSPIRATION_CTAS = exports.BOLD_MAY_TAO_TONE = void 0;
exports.isBoldMayTaoTone = isBoldMayTaoTone;
exports.getPersonalTonePromptBlock = getPersonalTonePromptBlock;
exports.BOLD_MAY_TAO_TONE = 'bold_may_tao';
exports.MAY_TAO_INSPIRATION_CTAS = [
    'Đứng dậy đi.',
    'Làm ngay hôm nay.',
    'Đừng để sự lười biếng chôn sống cuộc đời mày.',
    'Mày nghĩ sao?',
    'Ai cần nghe điều này thì gửi cho họ.',
];
exports.BOLD_MAY_TAO_TONE_LABEL = 'Gai góc mạnh / Mày - Tao truyền cảm hứng';
exports.BOLD_MAY_TAO_TONE_DESCRIPTION = 'Phong cách xưng mày-tao, mạnh, thẳng, truyền động lực như lời khuyên của một người bạn thân.';
exports.BOLD_MAY_TAO_PROMPT_BLOCK = `
VĂN PHONG BỔ SUNG — gai góc mạnh (nếu chọn xưng mày-tao):
- Xưng hô "mày - tao" khi phù hợp, KHÔNG lạm dụng "Mày à," làm mở đầu
- Gai góc, thẳng, truyền động lực — ngôn từ đời, có lực, không văn mẫu
- KHÔNG bài bán hàng; KHÔNG CTA mua hàng

CẤU TRÚC: Hook đa dạng → vấn đề thật → sự thật khó nghe → lời khuyên cụ thể → CTA tương tác nhẹ

TUYỆT ĐỐI KHÔNG: xúc phạm cá nhân quá đà; chửi thề tục; nội dung bán hàng
`.trim();
function isBoldMayTaoTone(tone) {
    return tone === exports.BOLD_MAY_TAO_TONE;
}
function getPersonalTonePromptBlock(tone) {
    if (isBoldMayTaoTone(tone))
        return exports.BOLD_MAY_TAO_PROMPT_BLOCK;
    return '';
}
