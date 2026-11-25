"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSenderDomain = normalizeSenderDomain;
exports.isValidSenderDomain = isValidSenderDomain;
exports.fromEmailMatchesDomain = fromEmailMatchesDomain;
exports.defaultSpfValue = defaultSpfValue;
exports.defaultDmarcValue = defaultDmarcValue;
exports.buildDomainDnsRecords = buildDomainDnsRecords;
exports.lookupTxt = lookupTxt;
exports.lookupCname = lookupCname;
exports.spfAllowsSes = spfAllowsSes;
exports.hasDmarc = hasDmarc;
exports.checkDomainDns = checkDomainDns;
const promises_1 = require("node:dns/promises");
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
function normalizeSenderDomain(input) {
    let value = input.trim().toLowerCase();
    value = value.replace(/^https?:\/\//, '');
    value = value.replace(/\/.*$/, '');
    value = value.replace(/:\d+$/, '');
    value = value.replace(/\.$/, '');
    value = value.replace(/^www\./, '');
    return value;
}
function isValidSenderDomain(domain) {
    return DOMAIN_RE.test(domain) && domain.length <= 253;
}
function fromEmailMatchesDomain(email, domain) {
    const host = email.split('@')[1]?.toLowerCase() || '';
    return host === domain;
}
function defaultSpfValue() {
    return 'v=spf1 include:amazonses.com ~all';
}
function defaultDmarcValue() {
    return 'v=DMARC1; p=none;';
}
function buildDomainDnsRecords(input) {
    const domain = input.domain;
    const records = [];
    const dkims = input.dkimRecords?.length
        ? input.dkimRecords
        : [];
    dkims.forEach((row, i) => {
        records.push({
            key: `dkim-${i + 1}`,
            purpose: 'DKIM',
            title: dkims.length > 1 ? `Chữ ký email (DKIM) ${i + 1}/${dkims.length}` : 'Chữ ký email (DKIM)',
            hint: 'Giúp hộp thư nhận biết email do bạn gửi, không phải giả mạo.',
            type: 'CNAME',
            host: row.host,
            value: row.value,
        });
    });
    records.push({
        key: 'spf',
        purpose: 'SPF',
        title: 'Cho phép gửi email (SPF)',
        hint: 'Nếu tên miền đã có SPF, hãy thêm include:amazonses.com vào bản ghi đó — không tạo SPF thứ hai.',
        type: 'TXT',
        host: '@',
        value: input.spfValue || defaultSpfValue(),
    });
    records.push({
        key: 'dmarc',
        purpose: 'DMARC',
        title: 'Bảo vệ thương hiệu (DMARC)',
        hint: 'Bắt đầu với p=none là an toàn. Có thể nhờ kỹ thuật viên siết sau.',
        type: 'TXT',
        host: '_dmarc',
        value: input.dmarcValue || defaultDmarcValue(),
    });
    return records;
}
function normalizeLookupName(value) {
    return value.replace(/\.$/, '').toLowerCase();
}
async function withTimeout(promise, ms, fallback) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((resolve) => {
                timer = setTimeout(() => resolve(fallback), ms);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
function publicResolver() {
    const resolver = new promises_1.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);
    return resolver;
}
async function lookupTxt(name) {
    const resolver = publicResolver();
    try {
        const rows = await withTimeout(resolver.resolveTxt(name), 5000, []);
        return rows.map((parts) => parts.join('').replace(/^"|"$/g, '').trim()).filter(Boolean);
    }
    catch {
        return [];
    }
}
async function lookupCname(name) {
    const resolver = publicResolver();
    try {
        const rows = await withTimeout(resolver.resolveCname(name), 5000, []);
        return rows.map(normalizeLookupName).filter(Boolean);
    }
    catch {
        return [];
    }
}
function spfAllowsSes(txtRecords) {
    return txtRecords.some((txt) => {
        const lower = txt.toLowerCase();
        return lower.startsWith('v=spf1') && lower.includes('include:amazonses.com');
    });
}
function hasDmarc(txtRecords) {
    return txtRecords.some((txt) => txt.toLowerCase().includes('v=dmarc1'));
}
async function checkDomainDns(input) {
    const domain = input.domain;
    const txt = await lookupTxt(domain);
    const dmarcTxt = await lookupTxt(`_dmarc.${domain}`);
    const dkimOk = input.dkimRecords.length > 0 &&
        (await Promise.all(input.dkimRecords.map(async (row) => {
            const fqdn = row.host.includes(domain) ? row.host : `${row.host}.${domain}`;
            const found = await lookupCname(fqdn);
            return found.includes(normalizeLookupName(row.value));
        }))).every(Boolean);
    return {
        dkim: dkimOk,
        spf: spfAllowsSes(txt),
        dmarc: hasDmarc(dmarcTxt),
    };
}
