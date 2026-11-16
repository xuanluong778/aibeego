// Real publish service + isolated PostgreSQL; never reads production .env or customer data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),dbRequire=createRequire(path.join(root,'packages/database/package.json')),apiRequire=createRequire(path.join(root,'apps/api/package.json'));
apiRequire('reflect-metadata');
const {PrismaClient}=dbRequire('@prisma/client');
const {LANDING_PAGE_SYSTEM_TEMPLATES}=require('../packages/shared/dist');
const {LandingPagesService}=require('../apps/api/dist/landing-pages/landing-pages.service');
const {LandingPagePlatformDomains,normalizePlatformSubdomain,reservedPlatformSubdomain}=require('../apps/api/dist/landing-pages/landing-page-platform-domain');
const {LandingPageDomainManager,domainMethods}=require('../apps/api/dist/landing-pages/landing-page-domain-manager');
const dburl=new URL(process.env.DATABASE_URL||'http://invalid');
if(dburl.hostname!=='127.0.0.1'||dburl.port!=='15449'||dburl.pathname!=='/platformqa')throw Error('Tests require disposable platformqa database on 127.0.0.1:15449.');
const db=new PrismaClient(),manager=new LandingPagePlatformDomains(db),domains=new LandingPageDomainManager(db);
const service=Object.create(LandingPagesService.prototype);service.prisma=db;service.rateLimit={assertWithinLimit(){}};
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS',name)}catch(error){failed++;console.error('FAIL',name,error)}}
const spec=()=>{const value=structuredClone(LANDING_PAGE_SYSTEM_TEMPLATES.find(x=>x.slug==='product-launch').spec);value.meta={...value.meta,clientRevision:1};return value};
let sequence=0;
async function page(org,options={}){return db.landingPage.create({data:{organizationId:org.id,name:'Subdomain QA '+(++sequence),slug:'page-'+sequence,draftSpec:spec(),...options}})}
const user=org=>({id:'qa-user',organizationId:org.id,role:'OWNER'});
const publish=(org,p,label)=>service.publish(user(org),p.id,{publicationTarget:'subdomain',subdomainSlug:label,clientRevision:1});
async function migrations(){for(const name of ['20261115170000_landing_domain_connections','20261116110000_landing_platform_domains']){const sql=fs.readFileSync(path.join(root,'packages/database/prisma/migrations',name,'migration.sql'),'utf8');for(const statement of sql.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement)}}
async function main(){
 await migrations();
 const a=await db.organization.create({data:{name:'Platform QA A',slug:'platform-qa-a-'+randomUUID()}}),b=await db.organization.create({data:{name:'Platform QA B',slug:'platform-qa-b-'+randomUUID()}});
 const first=await page(a,{slug:'shared-slug'}),second=await page(b,{slug:'shared-slug'});
 try{
  await test('Label normalization accepts ASCII labels and rejects URLs/ports/dots/Unicode/oversize',()=>{
   assert.equal(normalizePlatformSubdomain(' My-Store123 '),'my-store123');assert.equal(normalizePlatformSubdomain('a'.repeat(63)),'a'.repeat(63));
   for(const value of ['',null,undefined,[],{},'ab','-store','store-','foo.bar','foo.aibeego.com','https://foo','foo:443','đẹp','foo_bar','xn--shop','a'.repeat(64),'../admin'])assert.throws(()=>normalizePlatformSubdomain(value),String(value));
  });
  await test('Infrastructure names and operator-configured labels are reserved',()=>{
   for(const label of ['www','api','app','admin','auth','mail','test','lp-edge','cdn','ns1'])assert.equal(reservedPlatformSubdomain(label),true,label);
   process.env.LANDING_PAGE_PLATFORM_RESERVED_SUBDOMAINS='special';assert.equal(reservedPlatformSubdomain('special'),true);delete process.env.LANDING_PAGE_PLATFORM_RESERVED_SUBDOMAINS;
  });
  await test('Feature disabled keeps path publish available and rejects subdomain claims',async()=>{
   delete process.env.LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED;
   const p=await page(a);assert.equal((await service.publicationOptions(user(a),p.id)).enabled,false);await assert.rejects(publish(a,p,'feature-off'));
   const result=await service.publish(user(a),p.id,{clientRevision:1,publicationTarget:'path'});assert.equal(result.status,'PUBLISHED');assert.equal(result.publicUrl,null);assert.equal(await manager.current(p.id),null);
   process.env.LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED='true';
  });
  await test('Options/availability reject access to another tenant page',async()=>{
   for(const fn of [()=>service.publicationOptions(user(b),first.id),()=>service.subdomainAvailability(user(b),first.id,'tenant-test'),()=>publish(b,first,'tenant-test')])await assert.rejects(fn());
  });
  await test('Availability gives no tenant details and never reserves the name',async()=>{
   const result=await service.subdomainAvailability(user(a),first.id,'creative-lab');assert.equal(result.available,true);assert.equal(result.hostname,'creative-lab.aibeego.com');assert.equal(JSON.stringify(result).includes(a.id),false);assert.equal(await manager.current(first.id),null);
  });
  await test('Publish atomically saves the chosen subdomain and published snapshot',async()=>{
   const result=await publish(a,first,'creative-lab');assert.equal(result.publicUrl,'https://creative-lab.aibeego.com/');assert.equal(result.platformSubdomain,'creative-lab');assert.equal(result.status,'PUBLISHED');assert.equal(result.subdomainSlug,'creative-lab');
   assert.equal(await db.landingPageVersion.count({where:{landingPageId:first.id}}),1);assert.equal((await manager.current(first.id)).hostname,'creative-lab.aibeego.com');
  });
  await test('Editor reload preserves the selected public URL and ordinary prefix slugs still work',async()=>{
   const loaded=await service.get(user(a),first.id);assert.equal(loaded.publicUrl,'https://creative-lab.aibeego.com/');
   const ordinary=await page(a,{slug:'lp-platform-friendly-page'});await service.publish(user(a),ordinary.id,{publicationTarget:'path',clientRevision:1});assert.equal((await service.getPublicBySlug(ordinary.slug,a.id)).id,ordinary.id);
  });
  await test('Two tenants with the same slug resolve to their exact page and canonical hostname',async()=>{
   await publish(b,second,'other-creative');const binding=await domains.resolveHost('creative-lab.aibeego.com');assert.equal(binding.pageId,first.id);assert.equal(binding.organizationId,a.id);
   const payload=await service.getPublicBySlug(binding.publicKey);assert.equal(payload.id,first.id);assert.equal(payload.seo.canonical,'https://creative-lab.aibeego.com/');assert.equal((await domains.resolveHost('other-creative.aibeego.com')).pageId,second.id);
  });
  await test('Host scoping ignores a forged organizationId and rejects another binding key',async()=>{
   assert.equal(await service.domainOrganization('creative-lab.aibeego.com','shared-slug',b.id),a.id);
   const foreign=await domains.resolveHost('other-creative.aibeego.com');await assert.rejects(service.domainOrganization('creative-lab.aibeego.com',foreign.publicKey,b.id));
   await assert.rejects(service.domainOrganization('creative-lab.aibeego.com','other-slug',b.id));
  });
  await test('Republish by an old client preserves the existing binding and public URL',async()=>{
   const before=await manager.current(first.id);const result=await service.publish(user(a),first.id,{clientRevision:1});assert.equal(result.publicUrl,'https://creative-lab.aibeego.com/');assert.equal((await manager.current(first.id)).binding_id,before.binding_id);
  });
  await test('Taken/reserved names cannot replace a previous publication',async()=>{
   const before=await manager.current(second.id),versions=await db.landingPageVersion.count({where:{landingPageId:second.id}});
   await assert.rejects(publish(b,second,'creative-lab'));await assert.rejects(publish(b,second,'api'));
   assert.equal((await manager.current(second.id)).binding_id,before.binding_id);assert.equal(await db.landingPageVersion.count({where:{landingPageId:second.id}}),versions);assert.equal((await db.landingPage.findUnique({where:{id:second.id}})).status,'PUBLISHED');
  });
  await test('Stale revision cannot reserve a name or create a public snapshot',async()=>{
   const p=await page(a);await assert.rejects(service.publish(user(a),p.id,{publicationTarget:'subdomain',subdomainSlug:'stale-revision',clientRevision:0}));assert.equal(await manager.current(p.id),null);assert.equal((await db.landingPage.findUnique({where:{id:p.id}})).status,'DRAFT');
  });
  await test('Invalid spec and missing label do not publish or consume subdomains',async()=>{
   const invalid=spec();invalid.blocks=invalid.blocks.map(block=>({...block,enabled:false}));const p=await page(a,{draftSpec:invalid});await assert.rejects(publish(a,p,'invalid-spec'),error=>error.getResponse?.().code==='INVALID_SPEC');assert.equal(await manager.current(p.id),null);
   const valid=await page(a);await assert.rejects(service.publish(user(a),valid.id,{publicationTarget:'subdomain',clientRevision:1}));await assert.rejects(service.publish(user(a),valid.id,{subdomainSlug:'orphan-field',clientRevision:1}));
  });
  await test('Concurrent claims produce one owner; loser publish transaction is rolled back',async()=>{
   const p=await page(a),q=await page(b);const results=await Promise.allSettled([publish(a,p,'race-winner'),publish(b,q,'race-winner')]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
   const loser=results[0].status==='rejected'?p:q;assert.equal((await db.landingPage.findUnique({where:{id:loser.id}})).status,'DRAFT');assert.equal(await manager.current(loser.id),null);assert.equal(await db.landingPageVersion.count({where:{landingPageId:loser.id}}),0);
  });
  await test('Rename invalidates the old hostname and binding key immediately',async()=>{
   const old=await domains.resolveHost('creative-lab.aibeego.com');await publish(a,first,'creative-renamed');assert.equal(await domains.resolveHost('creative-lab.aibeego.com'),null);assert.equal(await manager.resolveKey(old.publicKey),null);assert.equal((await domains.resolveHost('creative-renamed.aibeego.com')).pageId,first.id);
  });
  await test('Unpublish blocks routing while retaining the owner reservation',async()=>{
   const key=(await domains.resolveHost('creative-renamed.aibeego.com')).publicKey;await service.unpublish(user(a),first.id);assert.equal(await domains.resolveHost('creative-renamed.aibeego.com'),null);assert.equal(await manager.resolveKey(key),null);assert.equal((await manager.availability(b.id,second.id,'creative-renamed')).available,false);await publish(a,first,'creative-renamed');assert.equal((await domains.resolveHost('creative-renamed.aibeego.com')).publicKey,key);
  });
  await test('Path-only publishing detaches the subdomain without losing the page',async()=>{
   const old=(await domains.resolveHost('other-creative.aibeego.com')).publicKey;const result=await service.publish(user(b),second.id,{publicationTarget:'path',clientRevision:1});assert.equal(result.publicUrl,null);assert.equal(await manager.current(second.id),null);assert.equal(await manager.resolveKey(old),null);assert.equal(result.status,'PUBLISHED');
  });
  await test('Archived and empty published snapshots cannot resolve a platform domain',async()=>{
   const p=await page(a);await publish(a,p,'archive-check');await db.landingPage.update({where:{id:p.id},data:{status:'ARCHIVED'}});assert.equal(await domains.resolveHost('archive-check.aibeego.com'),null);await assert.rejects(publish(a,p,'archive-check'));
   await db.$executeRaw`UPDATE landing_pages SET status='PUBLISHED',published_spec=NULL WHERE id=${p.id}`;assert.equal(await domains.resolveHost('archive-check.aibeego.com'),null);
  });
  await test('Verified legacy custom-domain bindings cannot be stolen by platform publish',async()=>{
   const legacy=await page(a,{status:'PUBLISHED',publishedSpec:spec()});await db.landingPageDomainConnection.create({data:{landingPageId:legacy.id,bindingId:randomUUID(),hostname:'legacy-protected.aibeego.com',verificationToken:'legacy-qa',verifiedAt:new Date()}});
   assert.equal((await manager.availability(b.id,second.id,'legacy-protected')).available,false);await assert.rejects(publish(b,second,'legacy-protected'));
  });
  await test('New custom-domain claims cannot take platform-owned aibeego.com names',async()=>{
   await assert.rejects(domains.attach(b.id,second.id,'creative-renamed.aibeego.com'),/Xuất bản/);
  });
  await test('Legacy DNS verification cannot overwrite another platform owner',async()=>{
   const legacy=await page(b,{status:'PUBLISHED',publishedSpec:spec()});await db.landingPageDomainConnection.create({data:{landingPageId:legacy.id,bindingId:randomUUID(),hostname:'creative-renamed.aibeego.com',verificationToken:'legacy-qa'}});
   const fake=new LandingPageDomainManager(db,async()=>({ownership:true,routing:true,addresses:['1.1.1.1'],edge:{target:'aibeego.com',addresses:['1.1.1.1'],ready:true},cnames:[],error:null}),async()=>true);
   await assert.rejects(fake.verify(b.id,legacy.id),/trang khác/);assert.equal((await domains.resolveHost('creative-renamed.aibeego.com')).pageId,first.id);
  });
  await test('Legacy verification and platform publish serialize on the same page without deadlock or dual ownership',async()=>{
   for(let i=0;i<3;i++){
    const p=await page(a,{status:'PUBLISHED',publishedSpec:spec()}),label='same-page-race-'+i;
    await db.landingPageDomainConnection.create({data:{landingPageId:p.id,bindingId:randomUUID(),hostname:label+'.aibeego.com',verificationToken:'legacy-qa'}});
    const fake=new LandingPageDomainManager(db,async()=>({ownership:true,routing:true,addresses:['1.1.1.1'],edge:{target:'aibeego.com',addresses:['1.1.1.1'],ready:true},cnames:[],error:null}),async()=>false);
    const results=await Promise.allSettled([publish(a,p,label),fake.verify(a.id,p.id)]);
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    const rejected=results.find(x=>x.status==='rejected');assert.equal(rejected.reason.getStatus?.(),409,'race should return a domain conflict, never a database deadlock');
    const platform=await manager.current(p.id),legacy=await db.landingPageDomainConnection.findUnique({where:{landingPageId:p.id}});
    assert.equal(!!platform&&!!legacy.verifiedAt,false);
   }
  });
  await test('Disabling platform publication fails routing closed without affecting path content',async()=>{
   const key=(await domains.resolveHost('creative-renamed.aibeego.com')).publicKey;delete process.env.LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED;assert.equal(await manager.resolveHost('creative-renamed.aibeego.com'),null);assert.equal(await manager.resolveKey(key),null);const payload=await service.getPublicBySlug(first.slug,a.id);assert.equal(payload.id,first.id);process.env.LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED='true';
  });
 }finally{await db.organization.deleteMany({where:{id:{in:[a.id,b.id]}}});await db.$disconnect()}
 console.log(`PLATFORM RESULT ${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
}
main().catch(async error=>{console.error(error);await db.$disconnect();process.exitCode=1});
