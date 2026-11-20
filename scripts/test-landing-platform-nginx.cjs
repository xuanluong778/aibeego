// Actual nginx + Nest public controller + published page service on private QA ports.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {spawn,execFileSync,execFile}=require('node:child_process'),{promisify}=require('node:util'),{createRequire}=require('node:module'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'.platform-subdomain-qa/nginx');fs.mkdirSync(qa,{recursive:true});
const apiRequire=createRequire(path.join(root,'apps/api/package.json')),dbRequire=createRequire(path.join(root,'packages/database/package.json'));apiRequire('reflect-metadata');
const {PrismaClient}=dbRequire('@prisma/client'),{Module}=apiRequire('@nestjs/common'),{NestFactory}=apiRequire('@nestjs/core');
const {LandingPagesPublicController}=require('../apps/api/dist/landing-pages/landing-pages-public.controller'),{LandingPagesService}=require('../apps/api/dist/landing-pages/landing-pages.service'),{LandingPageTemplatePackService}=require('../apps/api/dist/landing-pages/landing-page-template-pack.service');
const {LANDING_PAGE_SYSTEM_TEMPLATES}=require('../packages/shared/dist');
const guard=new URL(process.env.DATABASE_URL||'http://invalid');if(guard.hostname!=='127.0.0.1'||guard.port!=='15449'||guard.pathname!=='/platformqa')throw Error('Disposable platformqa database required.');
const db=new PrismaClient(),run=promisify(execFile),delay=ms=>new Promise(r=>setTimeout(r,ms));let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS',name)}catch(error){failed++;console.error('FAIL',name,error.message)}}
async function curl(host,uri='/',extra=[]){return (await run('curl',['--silent','--show-error','--max-time','12','--noproxy','*','--cacert',path.join(qa,'wildcard.crt'),'--resolve',host+':19444:127.0.0.1','-D','-','https://'+host+':19444'+uri,...extra])).stdout}
async function main(){
 let app,bridge,nginx,orgs=[];
 try{
  process.env.LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED='true';
  const service=Object.create(LandingPagesService.prototype);service.prisma=db;service.rateLimit={assertWithinLimit(){}};
  for(const letter of ['A','B'])orgs.push(await db.organization.create({data:{name:'Platform Edge '+letter,slug:'platform-edge-'+letter.toLowerCase()+'-'+randomUUID()}}));
  const spec=structuredClone(LANDING_PAGE_SYSTEM_TEMPLATES.find(x=>x.slug==='product-launch').spec);spec.meta={...spec.meta,clientRevision:1};
  const pages=[];for(const org of orgs)pages.push(await db.landingPage.create({data:{organizationId:org.id,name:'Platform '+org.name.at(-1),slug:'shared-slug',draftSpec:spec}}));
  const publish=(index,label)=>service.publish({organizationId:orgs[index].id,id:'qa',role:'OWNER'},pages[index].id,{publicationTarget:'subdomain',subdomainSlug:label,clientRevision:1});
  await publish(0,'platform-alpha');await publish(1,'platform-bravo');
  class QaModule{};Module({controllers:[LandingPagesPublicController],providers:[{provide:LandingPagesService,useValue:service},{provide:LandingPageTemplatePackService,useValue:{}}]})(QaModule);
  app=await NestFactory.create(QaModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(19401,'127.0.0.1');
  const seen=[];
  bridge=http.createServer(async(req,res)=>{
   if(req.url.startsWith('/api/')){const upstream=http.request({hostname:'127.0.0.1',port:19401,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});upstream.on('error',()=>{res.statusCode=502;res.end('upstream error')});req.pipe(upstream);return}
   seen.push(req.url);
   if(req.url.startsWith('/_next/static/')){res.end('asset');return}
   if(req.url.startsWith('/p/')){try{const key=req.url.split('/')[2].split('?')[0],payload=await service.getPublicBySlug(key);res.setHeader('Content-Type','text/html');res.end('<h1>'+payload.name+'</h1><p>'+payload.id+'</p>')}catch{res.statusCode=404;res.end('not published')}return}
   res.statusCode=404;res.end('not found');
  });await new Promise(r=>bridge.listen(19402,'127.0.0.1',r));
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=*.aibeego.com','-addext','subjectAltName=DNS:*.aibeego.com','-keyout',path.join(qa,'wildcard.key'),'-out',path.join(qa,'wildcard.crt')],{stdio:'ignore'});
  let config=fs.readFileSync(path.join(root,'deploy/aibeego-vps/platform-subdomains/nginx.platform-subdomains.conf.template'),'utf8');
  config=config.replaceAll('116.118.45.72:80','127.0.0.1:19081').replaceAll('116.118.45.72:443','127.0.0.1:19444').replaceAll('127.0.0.1:3999','127.0.0.1:19402').replaceAll('/etc/letsencrypt/live/aibeego-wildcard/fullchain.pem',path.join(qa,'wildcard.crt')).replaceAll('/etc/letsencrypt/live/aibeego-wildcard/privkey.pem',path.join(qa,'wildcard.key'));
  const sentinel=`server { listen 127.0.0.1:19444 ssl; server_name test.aibeego.com; ssl_certificate ${qa}/wildcard.crt; ssl_certificate_key ${qa}/wildcard.key; location / { return 200 "existing explicit host kept"; } }`;
  fs.writeFileSync(path.join(qa,'nginx.conf'),`worker_processes 1; pid ${qa}/nginx.pid; error_log ${qa}/error.log; events {worker_connections 64;} http {access_log off; ${config}\n${sentinel}}`);
  execFileSync('nginx',['-t','-p',qa+'/', '-c',path.join(qa,'nginx.conf')],{stdio:'pipe'});
  nginx=spawn('nginx',['-p',qa+'/', '-c',path.join(qa,'nginx.conf'),'-g','daemon off;'],{stdio:['ignore','ignore','pipe']});let logs='';nginx.stderr.on('data',chunk=>logs+=chunk);
  let ready=false;for(let i=0;i<40;i++){try{await fetch('http://127.0.0.1:19081/',{redirect:'manual'});ready=true;break}catch{}await delay(100)}if(!ready)throw Error('QA nginx failed: '+logs);
  await test('Shared wildcard HTTPS serves the selected published page',async()=>{const text=await curl('platform-alpha.aibeego.com','/?utm_source=qa');assert.match(text,/200/);assert.match(text,new RegExp(pages[0].id));assert.match(text,/Platform A/);assert.match(text,new RegExp('x-lp-page-id: '+pages[0].id,'i'));assert.match(seen.at(-1),/^\/p\/lp-platform-/);assert.match(seen.at(-1),/utm_source=qa/)});
  await test('Identical slugs from different tenants serve their own page',async()=>{const text=await curl('platform-bravo.aibeego.com');assert.match(text,new RegExp(pages[1].id));assert.doesNotMatch(text,new RegExp(pages[0].id))});
  await test('Client routing-header spoofing cannot select another tenant',async()=>{const foreign=await service.resolveDomainHost('platform-bravo.aibeego.com');const text=await curl('platform-alpha.aibeego.com','/',['-H','X-LP-Public-Key: '+foreign.publicKey,'-H','X-LP-Page-Id: '+pages[1].id]);assert.match(text,new RegExp(pages[0].id));assert.doesNotMatch(text,new RegExp(pages[1].id))});
  await test('Exact existing host keeps precedence over the platform regex',async()=>{assert.match(await curl('test.aibeego.com'),/existing explicit host kept/)});
  await test('Unknown names and SNI/Host mismatches are denied',async()=>{assert.match(await curl('unassigned-name.aibeego.com'),/403/);assert.match(await curl('platform-alpha.aibeego.com','/',['-H','Host: platform-bravo.aibeego.com']),/421/)});
  await test('Public API scopes by Host and rejects foreign binding keys',async()=>{const text=await curl('platform-alpha.aibeego.com','/api/v1/landing-pages/public/shared-slug?organizationId='+orgs[1].id);assert.match(text,new RegExp(pages[0].id));const foreign=await service.resolveDomainHost('platform-bravo.aibeego.com');assert.match(await curl('platform-alpha.aibeego.com','/api/v1/landing-pages/public/'+foreign.publicKey),/403/)});
  await test('Private app/draft routes are unavailable on the platform hostname',async()=>{for(const uri of ['/api/v1/auth/me','/landing-pages/builder/any','/api/v1/landing-pages/public/preview/token','/api/v1/landing-pages/public/domains/resolve?host=platform-bravo.aibeego.com'])assert.match(await curl('platform-alpha.aibeego.com',uri),/404/)});
  await test('Renaming a published subdomain needs no nginx reload',async()=>{await publish(0,'platform-renamed');assert.match(await curl('platform-alpha.aibeego.com'),/403/);assert.match(await curl('platform-renamed.aibeego.com'),new RegExp(pages[0].id))});
  await test('Unpublish immediately denies existing hostname and asset requests',async()=>{await service.unpublish({organizationId:orgs[0].id,id:'qa',role:'OWNER'},pages[0].id);for(const uri of ['/','/_next/static/test.js'])assert.match(await curl('platform-renamed.aibeego.com',uri),/403/)});
  fs.writeFileSync(path.join(qa,'test-process.log'),logs);
 }finally{
  if(nginx){nginx.kill('SIGTERM');await new Promise(resolve=>{if(nginx.exitCode!==null)return resolve();nginx.once('exit',resolve)})}
  if(app)await app.close();if(bridge){bridge.closeAllConnections();await new Promise(r=>bridge.close(r))}
  if(orgs.length)await db.organization.deleteMany({where:{id:{in:orgs.map(o=>o.id)}}});await db.$disconnect();
 }
 console.log(`PLATFORM NGINX RESULT ${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
}
main().catch(async error=>{console.error(error);await db.$disconnect();process.exitCode=1});
