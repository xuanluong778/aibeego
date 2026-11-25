"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_VARIABLES = void 0;
exports.renderTemplate = renderTemplate;
exports.extractTemplateVariables = extractTemplateVariables;
exports.TEMPLATE_VARIABLES = [
    { key: 'customer_name', placeholder: '{{customer_name}}', label: 'Tên khách hàng' },
    { key: 'appointment_time', placeholder: '{{appointment_time}}', label: 'Thời gian hẹn' },
    { key: 'branch_name', placeholder: '{{branch_name}}', label: 'Chi nhánh' },
    { key: 'service_name', placeholder: '{{service_name}}', label: 'Dịch vụ' },
];
function renderTemplate(body, context) {
    let rendered = body;
    for (const [key, value] of Object.entries(context)) {
        if (value == null)
            continue;
        rendered = rendered.replaceAll(`{{${key}}}`, value);
    }
    return rendered;
}
function extractTemplateVariables(body) {
    const matches = body.match(/\{\{(\w+)\}\}/g) ?? [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}
