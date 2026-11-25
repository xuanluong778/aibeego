"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEfficiencyScore = computeEfficiencyScore;
exports.buildAiSuggestion = buildAiSuggestion;
exports.decimalToNumber = decimalToNumber;
function computeEfficiencyScore(m) {
    let score = 50;
    if (m.roas != null) {
        if (m.roas >= 4)
            score += 25;
        else if (m.roas >= 2)
            score += 15;
        else if (m.roas >= 1)
            score += 5;
        else
            score -= 20;
    }
    if (m.ctr >= 2)
        score += 10;
    else if (m.ctr < 0.5)
        score -= 10;
    const results = m.conversions + m.leads;
    if (m.spend > 0 && results === 0)
        score -= 25;
    if (results > 0 && m.cpa > 0 && m.cpa < 200_000)
        score += 10;
    return Math.max(0, Math.min(100, Math.round(score)));
}
function buildAiSuggestion(m, score) {
    const tips = [];
    if (m.spend > 0 && m.conversions + m.leads === 0) {
        tips.push('Chi tiêu cao nhưng chưa có lead/chuyển đổi — kiểm tra pixel/form và đối tượng.');
    }
    if (m.ctr < 0.8) {
        tips.push('CTR thấp — thử đổi hook, tiêu đề hoặc creative.');
    }
    if (m.roas != null && m.roas < 1) {
        tips.push('ROAS dưới 1 — cân nhắc giảm ngân sách hoặc tắt nhóm kém.');
    }
    if (m.cpm > 150_000) {
        tips.push('CPM cao — thu hẹp đối tượng hoặc thử placement khác.');
    }
    if (score >= 75) {
        tips.push('Hiệu quả tốt — có thể nhân bản ad set/ad group đang chạy tốt.');
    }
    if (!tips.length) {
        tips.push('Tiếp tục theo dõi 3–5 ngày trước khi tối ưu lớn.');
    }
    return tips.join(' ');
}
function decimalToNumber(v) {
    if (v == null)
        return 0;
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string')
        return parseFloat(v) || 0;
    if (typeof v === 'object' && v !== null && 'toNumber' in v) {
        return v.toNumber();
    }
    return Number(v) || 0;
}
