import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const PLATFORM_DOMAIN = 'aibeego.com';
const SYSTEM_LABELS = new Set(('www,app,api,admin,administrator,auth,accounts,account,dashboard,portal,console,login,logout,signup,register,billing,payments,checkout,mail,email,webmail,smtp,imap,pop,pop3,mx,autodiscover,autoconfig,ftp,sftp,ssh,ns,ns1,ns2,dns,cdn,assets,static,media,uploads,files,storage,images,img,video,docs,help,support,status,health,metrics,monitor,monitoring,panel,fastpanel,cpanel,webdisk,whm,dev,development,stage,staging,test,testing,qa,demo,preview,internal,private,secure,security,ssl,acme,_acme-challenge,lp,lp-edge,landing-pages,blog,news,marketing,www2').split(','));
type PlatformBinding = { landing_page_id: string; binding_id: string; label: string; hostname: string };

export function isPlatformDomainKey(key: string): boolean {
  return /^lp-platform-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key);
}
export function platformSubdomainsEnabled(): boolean {
  return process.env.LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED === 'true';
}
export function normalizePlatformSubdomain(input: string): string {
  const label = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(label) || label.startsWith('xn--')) {
    throw new BadRequestException('Tên cần từ 3–63 ký tự, chỉ dùng chữ a–z, số và dấu gạch ngang; không có dấu chấm hoặc gạch ngang ở đầu/cuối.');
  }
  return label;
}
export function reservedPlatformSubdomain(label: string): boolean {
  const extra = (process.env.LANDING_PAGE_PLATFORM_RESERVED_SUBDOMAINS || '').split(',').map(x => x.trim().toLowerCase());
  const hosts = (process.env.LANDING_PAGE_PLATFORM_HOSTS || '').split(',').map(x => x.trim().toLowerCase());
  return SYSTEM_LABELS.has(label) || extra.includes(label) || hosts.includes(label + '.' + PLATFORM_DOMAIN);
}

/** Platform-owned domains have no customer DNS/TXT claim. The publish transaction owns the binding. */
export class LandingPagePlatformDomains {
  constructor(private readonly db: any) {}
  private async page(org: string, id: string, db = this.db) {
    const page = await db.landingPage.findFirst({ where: { id, organizationId: org }, select: { id: true, slug: true, status: true, subdomainSlug: true } });
    if (!page) throw new NotFoundException('Không tìm thấy Landing Page trong tổ chức của bạn.');
    return page;
  }
  async current(id: string, db = this.db): Promise<PlatformBinding | null> {
    const rows = await db.$queryRaw`SELECT landing_page_id,binding_id,label,hostname FROM landing_page_platform_domains WHERE landing_page_id=${id}`;
    return rows[0] || null;
  }
  async options(org: string, id: string) {
    const page = await this.page(org, id), binding = await this.current(id);
    let suggestion = page.subdomainSlug || page.slug;
    try { suggestion = normalizePlatformSubdomain(suggestion); } catch { suggestion = 'trang-' + page.id.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase(); }
    if (reservedPlatformSubdomain(suggestion)) suggestion = ('trang-' + suggestion).slice(0, 63).replace(/-+$/, '');
    return { baseDomain: PLATFORM_DOMAIN, enabled: platformSubdomainsEnabled(), current: binding ? { label: binding.label, hostname: binding.hostname, url: 'https://' + binding.hostname + '/' } : null, suggestedLabel: binding?.label || suggestion, pathUrl: '/p/' + page.slug };
  }
  async availability(org: string, id: string, input: string, db = this.db) {
    await this.page(org, id, db);
    const label = normalizePlatformSubdomain(input), hostname = label + '.' + PLATFORM_DOMAIN;
    if (reservedPlatformSubdomain(label)) return { available: false, label, hostname, reason: 'RESERVED', message: 'Tên này dành riêng cho hệ thống. Hãy chọn tên khác.' };
    const existing = await db.$queryRaw`SELECT landing_page_id FROM landing_page_platform_domains WHERE hostname=${hostname} AND landing_page_id<>${id}`;
    const custom = await db.$queryRaw`SELECT landing_page_id FROM landing_page_domain_connections WHERE hostname=${hostname} AND verified_at IS NOT NULL`;
    const available = existing.length === 0 && custom.length === 0;
    return { available, label, hostname, reason: available ? null : 'TAKEN', message: available ? 'Bạn có thể sử dụng địa chỉ này.' : 'Tên này đã được sử dụng. Hãy chọn tên khác.' };
  }
  /** Must be called inside the same transaction that publishes the page. */
  async claim(tx: any, org: string, id: string, input: string) {
    if (!platformSubdomainsEnabled()) throw new BadRequestException('Địa chỉ miễn phí chưa sẵn sàng. Bạn vẫn có thể xuất bản bằng liên kết hiện có.');
    const hostname = normalizePlatformSubdomain(input) + '.' + PLATFORM_DOMAIN;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${hostname}))`;
    const result = await this.availability(org, id, input, tx);
    if (!result.available) throw new ConflictException({ code: result.reason === 'RESERVED' ? 'SUBDOMAIN_RESERVED' : 'SUBDOMAIN_TAKEN', message: result.message });
    const current = await this.current(id, tx);
    if (current?.hostname === result.hostname) return current;
    const bindingId = randomUUID();
    // The UNIQUE hostname constraint decides races; a preflight availability response never reserves a name.
    await tx.$executeRaw`INSERT INTO landing_page_platform_domains(landing_page_id,binding_id,label,hostname) VALUES(${id},${bindingId},${result.label},${result.hostname}) ON CONFLICT(landing_page_id) DO UPDATE SET binding_id=EXCLUDED.binding_id,label=EXCLUDED.label,hostname=EXCLUDED.hostname,updated_at=NOW()`;
    return { landing_page_id: id, binding_id: bindingId, label: result.label, hostname: result.hostname };
  }
  async release(tx: any, org: string, id: string) {
    await this.page(org, id, tx);
    await tx.$executeRaw`DELETE FROM landing_page_platform_domains WHERE landing_page_id=${id}`;
  }
  async resolveHost(hostname: string) {
    if (!platformSubdomainsEnabled()) return null;
    const suffix = '.' + PLATFORM_DOMAIN;
    if (!hostname.endsWith(suffix)) return null;
    const label = hostname.slice(0, -suffix.length);
    try { if (normalizePlatformSubdomain(label) !== label || reservedPlatformSubdomain(label)) return null; } catch { return null; }
    const rows = await this.db.$queryRaw`SELECT d.hostname,d.binding_id,p.id,p.slug,p.organization_id FROM landing_page_platform_domains d JOIN landing_pages p ON p.id=d.landing_page_id WHERE d.hostname=${hostname} AND p.status='PUBLISHED' AND p.published_spec IS NOT NULL LIMIT 1`;
    const row = rows[0];
    return row ? { pageId: row.id, slug: row.slug, organizationId: row.organization_id, hostname: row.hostname, publicKey: 'lp-platform-' + row.binding_id } : null;
  }
  async resolveKey(key: string) {
    if (!platformSubdomainsEnabled() || !isPlatformDomainKey(key)) return null;
    const id = key.slice('lp-platform-'.length);
    const rows = await this.db.$queryRaw`SELECT hostname FROM landing_page_platform_domains WHERE binding_id=${id}`;
    return rows[0] ? this.resolveHost(rows[0].hostname) : null;
  }
}
