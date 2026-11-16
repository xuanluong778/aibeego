import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import { request as httpsRequest } from 'node:https';

type Binding = { landing_page_id: string; binding_id: string; hostname: string; verification_token: string; ownership_verified_at: Date | null; verified_at: Date | null; tls_status: string; last_checked_at: Date | null; last_error: string | null };

export function normalizeWebDomain(input: string): string {
  let value = String(input || '').trim().toLowerCase();
  if (/^https?:\/\//.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { throw new BadRequestException('Tên miền không hợp lệ'); }
    if (url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) throw new BadRequestException('Chỉ nhập tên miền, không kèm đường dẫn hoặc cổng');
    value = url.hostname;
  }
  if (/[\s/?#:@\\]/.test(value)) throw new BadRequestException('Chỉ nhập hostname, không kèm đường dẫn, query hoặc cổng.');
  value = domainToASCII(value.replace(/\.$/, ''));
  if (!value || value.length > 253 || isIP(value) || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value) || /\.(?:local|localhost|internal)$/.test(value)) throw new BadRequestException('Hãy nhập tên miền public hợp lệ, ví dụ example.com hoặc www.example.com');
  return value;
}

export function platformHosts(): string[] {
  return [...new Set(['localhost', '127.0.0.1', '::1', 'web', 'api', 'aibeego.com', 'www.aibeego.com', 'app.aibeego.com', 'dev.aibeego.com', ...(process.env.LANDING_PAGE_PLATFORM_HOSTS || '').split(',')].map(x => x.trim().toLowerCase()).filter(Boolean))];
}
export function requestHostname(input: string): string {
  const raw = String(input || '').toLowerCase().trim();
  if (!raw || /[\s,/@\\]/.test(raw)) return '';
  try { return new URL('http://' + raw).hostname.replace(/\.$/, ''); } catch { return ''; }
}
export function isPublicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  if (isIP(ip) === 6) return !/^(?:::|fc|fd|fe[89ab]|ff)/i.test(ip);
  return false;
}
export function cnameTarget(): string {
  const fromEnv = (process.env.LANDING_PAGE_CNAME_TARGET || '').trim().toLowerCase().replace(/\.$/, '');
  if (fromEnv) return fromEnv;
  for (const raw of [process.env.APP_URL, process.env.API_URL]) {
    const v = String(raw || '').trim();
    if (!v) continue;
    try {
      const host = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v).hostname.toLowerCase().replace(/^www\./, '');
      if (host && !isIP(host) && host.includes('.')) return host;
    } catch { /* ignore malformed URL */ }
  }
  return 'lp-edge.aibeego.com';
}
async function lookup(type: 'resolve4' | 'resolve6' | 'resolveCname' | 'resolveTxt', host: string): Promise<any[]> {
  const resolver = new Resolver({ timeout: 2500, tries: 1 });
  try { return await resolver[type](host) as any[]; } catch { return []; }
}
export async function edgeConfiguration() {
  const target = cnameTarget();
  const [a,aaaa] = await Promise.all([lookup('resolve4',target),lookup('resolve6',target)]);
  const addresses = [...new Set([...a,...aaaa,...(process.env.LANDING_PAGE_EDGE_IPS || '').split(',').map(x=>x.trim())].filter(isPublicIp))];
  return { target, addresses, ready: addresses.length > 0, tlsMode: process.env.LANDING_PAGE_TLS_MODE || 'external' };
}
/** BIND/FastPanel/Vietnix often store TXT as `"value"`. Compare both forms. */
export function normalizeDnsTxtValue(value: string): string {
  let v = String(value || '').trim();
  if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
    v = v.slice(1, -1).trim();
  }
  return v.replace(/\\"/g, '"');
}

export function dnsTxtMatches(records: string[][], expected: string): boolean {
  const want = normalizeDnsTxtValue(expected);
  return records.some((record) => normalizeDnsTxtValue(Array.isArray(record) ? record.join('') : String(record)) === want);
}

export async function inspectDomainDns(host: string, token: string) {
  const [txt,cnames,a,aaaa,edge] = await Promise.all([lookup('resolveTxt','_aibeego-verify.'+host),lookup('resolveCname',host),lookup('resolve4',host),lookup('resolve6',host),edgeConfiguration()]);
  const expected = 'aibeego-domain=' + token;
  const ownership = dnsTxtMatches(txt as string[][], expected);
  const allAddresses = [...a,...aaaa];
  const addresses = allAddresses.filter(isPublicIp);
  const cname = cnames.some((name: string) => name.toLowerCase().replace(/\.$/,'') === edge.target);
  const addressMatch = addresses.length > 0 && addresses.length === allAddresses.length && addresses.every(ip=>edge.addresses.includes(ip));
  const routing = edge.ready && addressMatch;
  return { ownership, routing, edge, addresses, cnames, expected, error: !ownership ? 'Chưa tìm thấy TXT xác minh quyền sở hữu. Hãy kiểm tra tên và giá trị bản ghi.' : !edge.ready ? 'Máy chủ chưa cấu hình đích DNS public. Vui lòng liên hệ quản trị hệ thống.' : !routing ? 'DNS của tên miền chưa trỏ đúng về máy chủ landing page.' : null };
}
export async function inspectDomainHttps(host: string, pageId: string, addresses: string[]): Promise<boolean> {
  const address = addresses.find(isPublicIp); if (!address) return false;
  return new Promise(resolve=>{
    let settled=false;
    const finish=(ok:boolean)=>{if(!settled){settled=true;resolve(ok)}};
    const req=httpsRequest({ hostname:host, servername:host, port:443, path:'/', method:'GET', rejectUnauthorized:true, timeout:6000,
      lookup: ((_name:any,options:any,cb:any)=>options?.all?cb(null,[{address,family:isIP(address)}]):cb(null,address,isIP(address))) as any,
      headers:{'User-Agent':'AiBeeGo-Domain-Health/1.0'} },res=>{res.resume();finish(res.statusCode===200&&res.headers['x-lp-page-id']===pageId)});
    req.on('timeout',()=>{req.destroy();finish(false)});req.on('error',()=>finish(false));req.end();
  });
}

export class LandingPageDomainManager {
  constructor(private db: any, private inspectDns = inspectDomainDns, private inspectHttps = inspectDomainHttps) {}
  private async page(org: string, id: string) {
    const row=await this.db.landingPage.findFirst({where:{id,organizationId:org},select:{id:true,name:true,slug:true,status:true,subdomainSlug:true,customDomain:true}});
    if(!row)throw new NotFoundException('Không tìm thấy landing page trong tổ chức của bạn');return row;
  }
  private async binding(id:string, db=this.db): Promise<Binding|null> {
    const rows=await db.$queryRaw`SELECT * FROM landing_page_domain_connections WHERE landing_page_id=${id}`;return rows[0]||null;
  }
  private describe(row:any, b:Binding|null, edge:any) {
    const verified=Boolean(b?.verified_at);
    return { id:row.id,name:row.name,slug:row.slug,status:row.status,subdomainSlug:row.subdomainSlug,customDomain:b?.hostname||row.customDomain||null,
      customDomainStatus:verified?'ACTIVE':b?.last_error?'FAILED':(b||row.customDomain?'PENDING':null),customDomainError:b?.last_error||null,
      customDomainVerifiedAt:b?.verified_at||null,
      connection:b?{ hostname:b.hostname,ownershipVerified:Boolean(b.ownership_verified_at),dnsVerified:verified,tlsStatus:b.tls_status,
        ready:verified&&b.tls_status==='READY'&&row.status==='PUBLISHED',lastCheckedAt:b.last_checked_at,
        verification:{type:'TXT',name:'_aibeego-verify.'+b.hostname,value:'aibeego-domain='+b.verification_token},
        routing:{type:'CNAME',name:b.hostname,value:edge.target,addresses:edge.addresses},
        url:'https://'+b.hostname+'/',needsPublish:row.status!=='PUBLISHED'}:null };
  }
  async list(org:string) {
    const [pages,bindings,edge]=await Promise.all([
      this.db.landingPage.findMany({where:{organizationId:org},select:{id:true,name:true,slug:true,status:true,subdomainSlug:true,customDomain:true},orderBy:{updatedAt:'desc'}}),
      this.db.$queryRaw`SELECT d.* FROM landing_page_domain_connections d JOIN landing_pages p ON p.id=d.landing_page_id WHERE p.organization_id=${org}`,
      edgeConfiguration()]);
    return {items:pages.map((p:any)=>this.describe(p,bindings.find((b:Binding)=>b.landing_page_id===p.id)||null,edge)),
      architecture:{defaultSubdomain:'{subdomainSlug}.lp.aibeego.com',cnameTarget:edge.target,edgeAddresses:edge.addresses,platformReady:edge.ready,tlsMode:edge.tlsMode,
        message:edge.ready?null:'Quản trị viên cần cấu hình hostname/IP public cho máy chủ trước khi tên miền có thể hoạt động.'}};
  }
  async attach(org:string,id:string,input:string) {
    await this.page(org,id);const host=normalizeWebDomain(input);
    if(platformHosts().includes(host)||host===cnameTarget())throw new BadRequestException('Đây là tên miền hệ thống. Hãy dùng tên miền riêng của bạn.');
    const edge=await edgeConfiguration();
    return this.db.$transaction(async(tx:any)=>{
      // Serialize changes to this page and preserve idempotency for repeated saves.
      await tx.$queryRaw`SELECT id FROM landing_pages WHERE id=${id} AND organization_id=${org} FOR UPDATE`;
      const existing=await this.binding(id,tx);
      if(existing?.hostname===host)return this.describe(await this.page(org,id),existing,edge);
      const clash=await tx.$queryRaw`SELECT landing_page_id FROM landing_page_domain_connections WHERE hostname=${host} AND verified_at IS NOT NULL AND landing_page_id<>${id}`;
      if(clash.length)throw new ConflictException('Tên miền đã được xác minh cho landing page khác. Hãy tháo kết nối cũ trước.');
      const token=randomBytes(24).toString('hex'),key=randomUUID();
      await tx.$executeRaw`INSERT INTO landing_page_domain_connections(landing_page_id,binding_id,hostname,verification_token) VALUES(${id},${key},${host},${token})
        ON CONFLICT(landing_page_id) DO UPDATE SET binding_id=EXCLUDED.binding_id,hostname=EXCLUDED.hostname,verification_token=EXCLUDED.verification_token,ownership_verified_at=NULL,verified_at=NULL,tls_status='PENDING',tls_checked_at=NULL,last_checked_at=NULL,last_error=NULL,updated_at=NOW()`;
      // Keep pending claims in the connection table. Only a verified owner may
      // consume the legacy unique custom_domain slot.
      const page=await tx.landingPage.update({where:{id},data:{customDomain:null,customDomainStatus:'PENDING',customDomainVerifiedAt:null,customDomainError:null}});
      return this.describe(page,await this.binding(id,tx),edge);
    });
  }
  async verify(org:string,id:string) {
    const page=await this.page(org,id),b=await this.binding(id);if(!b)throw new BadRequestException('Hãy lưu tên miền để tạo bản ghi TXT xác minh trước.');
    if(b.last_checked_at&&Date.now()-new Date(b.last_checked_at).getTime()<5000)throw new BadRequestException('Vui lòng chờ vài giây trước khi kiểm tra lại DNS.');
    const dns=await this.inspectDns(b.hostname,b.verification_token),verified=dns.ownership&&dns.routing;
    let tls=false;
    const error=dns.error||(!tls&&verified?'DNS đã xác minh. HTTPS chưa sẵn sàng; kiểm tra edge/chứng chỉ và xuất bản trang.':null);
    try {
      await this.db.$transaction(async(tx:any)=>{
        const current=await tx.$queryRaw`SELECT binding_id FROM landing_page_domain_connections WHERE landing_page_id=${id} FOR UPDATE`;
        if(current[0]?.binding_id!==b.binding_id)throw new ConflictException('Tên miền vừa thay đổi. Hãy tải lại và kiểm tra domain mới.');
        await tx.$executeRaw`UPDATE landing_page_domain_connections SET ownership_verified_at=${dns.ownership?new Date():null},verified_at=${verified?new Date():null},tls_status=${tls?'READY':'PENDING'},tls_checked_at=NOW(),last_checked_at=NOW(),last_error=${error},updated_at=NOW() WHERE binding_id=${b.binding_id}`;
        await tx.landingPage.update({where:{id},data:{customDomain:verified?b.hostname:null,customDomainStatus:verified?'ACTIVE':'FAILED',customDomainVerifiedAt:verified?new Date():null,customDomainError:error?.slice(0,500)||null}});
      });
    } catch(e:any) { if(e.code==='P2002'||(e.code==='P2010'&&e.meta?.code==='23505'))throw new ConflictException('Tên miền vừa được xác minh hoặc đã gắn với trang khác.');throw e; }
    // Publish the DNS permission before probing HTTPS, so an on-demand edge can
    // obtain its certificate on this first handshake instead of being denied.
    if(verified&&page.status==='PUBLISHED') {
      tls=await this.inspectHttps(b.hostname,id,dns.addresses);
      if(tls)await this.db.$transaction(async(tx:any)=>{
        const current=await tx.$queryRaw`SELECT binding_id FROM landing_page_domain_connections WHERE landing_page_id=${id} FOR UPDATE`;
        if(current[0]?.binding_id!==b.binding_id)throw new ConflictException('Kết nối tên miền vừa thay đổi.');
        await tx.$executeRaw`UPDATE landing_page_domain_connections SET tls_status='READY',tls_checked_at=NOW(),last_error=NULL,updated_at=NOW() WHERE binding_id=${b.binding_id}`;
        await tx.landingPage.update({where:{id},data:{customDomainError:null}});
      });
    }
    return {page:this.describe(page,await this.binding(id),dns.edge),dns:{ok:verified,ownership:dns.ownership,routing:dns.routing,expected:dns.edge.target,error:dns.error,found:dns.cnames},https:{ready:tls},message:tls?'Tên miền và HTTPS đã hoạt động.':error};
  }
  async detach(org:string,id:string) {
    await this.page(org,id);
    await this.db.$transaction(async(tx:any)=>{
      await tx.$queryRaw`SELECT id FROM landing_pages WHERE id=${id} AND organization_id=${org} FOR UPDATE`;
      await tx.$executeRaw`DELETE FROM landing_page_domain_connections WHERE landing_page_id=${id}`;
      await tx.landingPage.update({where:{id},data:{customDomain:null,customDomainStatus:null,customDomainVerifiedAt:null,customDomainError:null}});
    });return {ok:true};
  }
  async resolveHost(input:string) {
    const host=requestHostname(input);if(!host||platformHosts().includes(host))return null;
    const rows=await this.db.$queryRaw`SELECT d.hostname,d.binding_id,p.id,p.slug,p.organization_id FROM landing_page_domain_connections d JOIN landing_pages p ON p.id=d.landing_page_id WHERE d.hostname=${host} AND d.verified_at IS NOT NULL AND p.status='PUBLISHED' AND p.published_spec IS NOT NULL LIMIT 1`;
    const r=rows[0];return r?{pageId:r.id,slug:r.slug,organizationId:r.organization_id,hostname:r.hostname,publicKey:'lp-domain-'+r.binding_id}:null;
  }
  async resolveKey(key:string) {
    const id=key.slice('lp-domain-'.length);if(!/^[a-f0-9-]{36}$/.test(id))return null;
    const rows=await this.db.$queryRaw`SELECT d.hostname,d.binding_id,p.id,p.slug,p.organization_id FROM landing_page_domain_connections d JOIN landing_pages p ON p.id=d.landing_page_id WHERE d.binding_id=${id} AND d.verified_at IS NOT NULL AND p.status='PUBLISHED' AND p.published_spec IS NOT NULL LIMIT 1`;
    const r=rows[0];return r?{pageId:r.id,slug:r.slug,organizationId:r.organization_id,hostname:r.hostname}:null;
  }
}

/** Used by the source service and the narrow deployment overlay alike. */
export const domainMethods = {
  async listDomains(this:any,org:string){return new LandingPageDomainManager(this.prisma).list(org)},
  async upsertDomain(this:any,user:any,id:string,dto:any){this.rateLimit?.assertWithinLimit('lp:domain-save:'+user.organizationId,20,60000,'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');return new LandingPageDomainManager(this.prisma).attach(user.organizationId,id,dto.customDomain)},
  async verifyDomain(this:any,user:any,id:string){this.rateLimit?.assertWithinLimit('lp:domain-check:'+user.organizationId,30,60000,'Bạn kiểm tra quá nhanh. Vui lòng thử lại sau.');return new LandingPageDomainManager(this.prisma).verify(user.organizationId,id)},
  async removeDomain(this:any,user:any,id:string){return new LandingPageDomainManager(this.prisma).detach(user.organizationId,id)},
  async resolveDomainHost(this:any,host:string){return new LandingPageDomainManager(this.prisma).resolveHost(host)},
  async getPublicByDomainKey(this:any,key:string){const r=await new LandingPageDomainManager(this.prisma).resolveKey(key);if(!r)throw new NotFoundException('Tên miền chưa xác minh hoặc trang chưa xuất bản');const page=await this.getPublicBySlug(r.slug,r.organizationId);return {...page,seo:{...page.seo,canonical:'https://'+r.hostname+'/'}}},
  async domainOrganization(this:any,host:string,slug:string,requested?:string){const h=requestHostname(host);if(platformHosts().includes(h))return requested;const r=await new LandingPageDomainManager(this.prisma).resolveHost(h);if(!r||r.slug!==slug)throw new ForbiddenException('Tên miền không được gắn với landing page này');return r.organizationId},
};
export function installDomainRuntime(Service:any) {
  Object.assign(Service.prototype,domainMethods);
  const original=Service.prototype.getPublicBySlug;
  Service.prototype.getPublicBySlug=function(slug:string,org?:string){return slug.startsWith('lp-domain-')?domainMethods.getPublicByDomainKey.call(this,slug):original.call(this,slug,org)};
}
