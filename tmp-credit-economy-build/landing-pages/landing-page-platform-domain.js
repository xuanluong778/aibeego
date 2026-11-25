"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingPagePlatformDomains = exports.PLATFORM_DOMAIN = void 0;
exports.isPlatformDomainKey = isPlatformDomainKey;
exports.platformSubdomainsEnabled = platformSubdomainsEnabled;
exports.normalizePlatformSubdomain = normalizePlatformSubdomain;
exports.reservedPlatformSubdomain = reservedPlatformSubdomain;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
exports.PLATFORM_DOMAIN = 'aibeego.com';
const SYSTEM_LABELS = new Set(('www,app,api,admin,administrator,auth,accounts,account,dashboard,portal,console,login,logout,signup,register,billing,payments,checkout,mail,email,webmail,smtp,imap,pop,pop3,mx,autodiscover,autoconfig,ftp,sftp,ssh,ns,ns1,ns2,dns,cdn,assets,static,media,uploads,files,storage,images,img,video,docs,help,support,status,health,metrics,monitor,monitoring,panel,fastpanel,cpanel,webdisk,whm,dev,development,stage,staging,test,testing,qa,demo,preview,internal,private,secure,security,ssl,acme,_acme-challenge,lp,lp-edge,landing-pages,blog,news,marketing,www2').split(','));
function isPlatformDomainKey(key) {
    return /^lp-platform-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key);
}
function platformSubdomainsEnabled() {
    return process.env.LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED === 'true';
}
function normalizePlatformSubdomain(input) {
    const label = typeof input === 'string' ? input.trim().toLowerCase() : '';
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(label) || label.startsWith('xn--')) {
        throw new common_1.BadRequestException('Tên cần từ 3–63 ký tự, chỉ dùng chữ a–z, số và dấu gạch ngang; không có dấu chấm hoặc gạch ngang ở đầu/cuối.');
    }
    return label;
}
function reservedPlatformSubdomain(label) {
    const extra = (process.env.LANDING_PAGE_PLATFORM_RESERVED_SUBDOMAINS || '').split(',').map(x => x.trim().toLowerCase());
    const hosts = (process.env.LANDING_PAGE_PLATFORM_HOSTS || '').split(',').map(x => x.trim().toLowerCase());
    return SYSTEM_LABELS.has(label) || extra.includes(label) || hosts.includes(label + '.' + exports.PLATFORM_DOMAIN);
}
/** Platform-owned domains have no customer DNS/TXT claim. The publish transaction owns the binding. */
class LandingPagePlatformDomains {
    db;
    constructor(db) {
        this.db = db;
    }
    async page(org, id, db = this.db) {
        const page = await db.landingPage.findFirst({ where: { id, organizationId: org }, select: { id: true, slug: true, status: true, subdomainSlug: true } });
        if (!page)
            throw new common_1.NotFoundException('Không tìm thấy Landing Page trong tổ chức của bạn.');
        return page;
    }
    async current(id, db = this.db) {
        const rows = await db.$queryRaw `SELECT landing_page_id,binding_id,label,hostname FROM landing_page_platform_domains WHERE landing_page_id=${id}`;
        return rows[0] || null;
    }
    async options(org, id) {
        const page = await this.page(org, id), binding = await this.current(id);
        let suggestion = page.subdomainSlug || page.slug;
        try {
            suggestion = normalizePlatformSubdomain(suggestion);
        }
        catch {
            suggestion = 'trang-' + page.id.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();
        }
        if (reservedPlatformSubdomain(suggestion))
            suggestion = ('trang-' + suggestion).slice(0, 63).replace(/-+$/, '');
        return { baseDomain: exports.PLATFORM_DOMAIN, enabled: platformSubdomainsEnabled(), current: binding ? { label: binding.label, hostname: binding.hostname, url: 'https://' + binding.hostname + '/' } : null, suggestedLabel: binding?.label || suggestion, pathUrl: '/p/' + page.slug };
    }
    async availability(org, id, input, db = this.db) {
        await this.page(org, id, db);
        const label = normalizePlatformSubdomain(input), hostname = label + '.' + exports.PLATFORM_DOMAIN;
        if (reservedPlatformSubdomain(label))
            return { available: false, label, hostname, reason: 'RESERVED', message: 'Tên này dành riêng cho hệ thống. Hãy chọn tên khác.' };
        const existing = await db.$queryRaw `SELECT landing_page_id FROM landing_page_platform_domains WHERE hostname=${hostname} AND landing_page_id<>${id}`;
        const custom = await db.$queryRaw `SELECT landing_page_id FROM landing_page_domain_connections WHERE hostname=${hostname} AND verified_at IS NOT NULL`;
        const available = existing.length === 0 && custom.length === 0;
        return { available, label, hostname, reason: available ? null : 'TAKEN', message: available ? 'Bạn có thể sử dụng địa chỉ này.' : 'Tên này đã được sử dụng. Hãy chọn tên khác.' };
    }
    /** Must be called inside the same transaction that publishes the page. */
    async claim(tx, org, id, input) {
        if (!platformSubdomainsEnabled())
            throw new common_1.BadRequestException('Địa chỉ miễn phí chưa sẵn sàng. Bạn vẫn có thể xuất bản bằng liên kết hiện có.');
        const hostname = normalizePlatformSubdomain(input) + '.' + exports.PLATFORM_DOMAIN;
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${hostname}))`;
        const result = await this.availability(org, id, input, tx);
        if (!result.available)
            throw new common_1.ConflictException({ code: result.reason === 'RESERVED' ? 'SUBDOMAIN_RESERVED' : 'SUBDOMAIN_TAKEN', message: result.message });
        const current = await this.current(id, tx);
        if (current?.hostname === result.hostname)
            return current;
        const bindingId = (0, node_crypto_1.randomUUID)();
        // The UNIQUE hostname constraint decides races; a preflight availability response never reserves a name.
        await tx.$executeRaw `INSERT INTO landing_page_platform_domains(landing_page_id,binding_id,label,hostname) VALUES(${id},${bindingId},${result.label},${result.hostname}) ON CONFLICT(landing_page_id) DO UPDATE SET binding_id=EXCLUDED.binding_id,label=EXCLUDED.label,hostname=EXCLUDED.hostname,updated_at=NOW()`;
        return { landing_page_id: id, binding_id: bindingId, label: result.label, hostname: result.hostname };
    }
    async release(tx, org, id) {
        await this.page(org, id, tx);
        await tx.$executeRaw `DELETE FROM landing_page_platform_domains WHERE landing_page_id=${id}`;
    }
    async resolveHost(hostname) {
        if (!platformSubdomainsEnabled())
            return null;
        const suffix = '.' + exports.PLATFORM_DOMAIN;
        if (!hostname.endsWith(suffix))
            return null;
        const label = hostname.slice(0, -suffix.length);
        try {
            if (normalizePlatformSubdomain(label) !== label || reservedPlatformSubdomain(label))
                return null;
        }
        catch {
            return null;
        }
        const rows = await this.db.$queryRaw `SELECT d.hostname,d.binding_id,p.id,p.slug,p.organization_id FROM landing_page_platform_domains d JOIN landing_pages p ON p.id=d.landing_page_id WHERE d.hostname=${hostname} AND p.status='PUBLISHED' AND p.published_spec IS NOT NULL LIMIT 1`;
        const row = rows[0];
        return row ? { pageId: row.id, slug: row.slug, organizationId: row.organization_id, hostname: row.hostname, publicKey: 'lp-platform-' + row.binding_id } : null;
    }
    async resolveKey(key) {
        if (!platformSubdomainsEnabled() || !isPlatformDomainKey(key))
            return null;
        const id = key.slice('lp-platform-'.length);
        const rows = await this.db.$queryRaw `SELECT hostname FROM landing_page_platform_domains WHERE binding_id=${id}`;
        return rows[0] ? this.resolveHost(rows[0].hostname) : null;
    }
}
exports.LandingPagePlatformDomains = LandingPagePlatformDomains;
