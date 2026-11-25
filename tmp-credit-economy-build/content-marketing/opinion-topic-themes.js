"use strict";
/**
 * Opinion topic themes — shared prompt hints for generate/rewrite (API).
 * Keep in sync with apps/web/src/lib/opinion-topic-themes.ts (ids + voice).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIFE_STORY_VOICE_BLOCK = exports.LIFE_STORY_STRUCTURE = exports.LIFE_STORY_STYLE_HINTS = exports.CLIP_LIFE_VOICE_BLOCK = exports.CLIP_LIFE_STRUCTURE = exports.CLIP_LIFE_STYLE_HINTS = exports.OPINION_LIFE_STORY_THEME_IDS = exports.OPINION_CLIP_LIFE_THEME_ID = void 0;
exports.isClipLifeTheme = isClipLifeTheme;
exports.isLifeStoryTheme = isLifeStoryTheme;
exports.OPINION_CLIP_LIFE_THEME_ID = 'clip_life_comment';
exports.OPINION_LIFE_STORY_THEME_IDS = [
    'raise_children',
    'parents_filial',
    'sibling_bond',
    'couple_family',
    'overcome_adversity',
    'fate_choice',
    'human_kindness',
    'gratitude',
    'forgive_let_go',
    'faith_hope',
    'money_feelings',
    'success_failure',
    'old_age_loneliness',
    'friendship_loyalty',
    'social_conduct',
];
/** Gợi ý nhịp câu — học phong cách, KHÔNG copy cứng vào bài, KHÔNG thành nhãn mục. */
exports.CLIP_LIFE_STYLE_HINTS = [
    'Mấy hôm nay tôi thấy một đoạn video…',
    'Nói thật, xem xong tôi cứ nghĩ mãi…',
    'Tôi không biết mọi người thấy sao…',
    'Điều tôi quan tâm không phải ai thắng ai thua…',
    'Nhưng ngẫm lại thì…',
    'Còn mọi người nghĩ thế nào?',
];
/** Mạch ẨN — AI tự triển khai, tuyệt đối không ghi thành tiêu đề trong bài. */
exports.CLIP_LIFE_STRUCTURE = `MẠCH ẨN (không hiện tiêu đề / nhãn mục trong bài):
Mở thẳng vào clip → kể ngắn sự việc → điều đáng suy nghĩ → chính kiến → nhìn thêm phía còn lại → lời khuyên thực tế → suy nghĩ/câu hỏi cuối.`;
exports.CLIP_LIFE_VOICE_BLOCK = `VĂN PHONG CLIP ĐỜI SỐNG (bắt buộc):
- Viết MỘT BÀI NÓI / BÀI ĐĂNG liền mạch — người dùng đọc thẳng Teleprompter được.
- CẤM nhãn mục / dàn ý: “Tình huống”, “Góc nhìn”, “Vấn đề”, “Phân tích”, “Bài học”, “Kết luận”, “Chủ đề đang bàn”.
- Giống lời nói thật: câu ngắn, đời thường; cho phép “nói thật”, “tôi nghĩ”, “nhưng ngẫm lại”, “thực ra”, “đôi khi”.
- Không lặp máy móc “theo quan điểm của tôi” / “tôi nhận ra rằng”.
- Không bản tin, nghị luận, giảng đạo, sáo ngữ AI.
- Không khẳng định thông tin chưa xác minh; không bịa lời / động cơ nhân vật.`;
exports.LIFE_STORY_STYLE_HINTS = [
    'Nói thật, chuyện này khiến tôi phải nghĩ…',
    'Tôi nghĩ…',
    'Nhưng ngẫm lại…',
    'Có một điều…',
    'Thực ra…',
    'Còn mọi người thì sao?',
];
exports.LIFE_STORY_STRUCTURE = `MẠCH ẨN (không hiện tiêu đề / nhãn mục trong bài):
Mở câu chuyện → tình huống đời thường → điều đáng suy nghĩ → chính kiến cá nhân → nhìn thêm phía cha mẹ và con cái (hoặc các phía liên quan) → lời khuyên thực tế → thông điệp cuối → câu hỏi tương tác.`;
exports.LIFE_STORY_VOICE_BLOCK = `VĂN PHONG ĐỜI SỐNG (bắt buộc):
- Viết MỘT BÀI NÓI liền mạch, tâm sự + lời khuyên nhẹ — sẵn sàng Teleprompter.
- CẤM nhãn: “Tình huống tôi muốn bàn”, “Góc nhìn”, “Vấn đề đáng nói”, “Bài học cuộc sống”, “Kết luận”.
- Câu ngắn, dân dã; chuyển ý tự nhiên, không gạch đầu dòng liệt kê.
- Không lặp máy móc “theo quan điểm của tôi” / “tôi nhận ra rằng”.
- CẤM nghị luận, diễn văn, giảng đạo, sáo ngữ AI.
- CẤM bịa trải nghiệm cá nhân nếu user chưa cung cấp.
- Không phán tuyệt đối; nhìn nhiều phía.`;
function isClipLifeTheme(themeId) {
    return themeId === exports.OPINION_CLIP_LIFE_THEME_ID;
}
function isLifeStoryTheme(themeId) {
    if (!themeId)
        return false;
    return exports.OPINION_LIFE_STORY_THEME_IDS.includes(themeId);
}
