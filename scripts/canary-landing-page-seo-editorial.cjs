// Real URL + configured AI on a disposable page. Generates/inspects only; never autosaves or publishes.
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const fixture=JSON.parse(fs.readFileSync('.tmp/lp-seo-editorial/http-fixture.json','utf8'));
const entry=fixture.pages.find(p=>p.kind==='seo'),base='http://localhost:8080';
async function api(path,body){const r=await fetch(`${base}/api/v1${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${fixture.token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.ok(r.ok,`${r.status}: ${JSON.stringify(data).slice(0,600)}`);return data;}
(async()=>{
  const before=await api(`/landing-pages/${entry.id}`);
  const read=await api(`/landing-pages/${entry.id}/ai-template-content/read-url`,{url:'https://daotaoseodigi.com/'});
  assert.equal(read.brief.brandName,'Đào Tạo SEO Digi');assert.equal(read.brief.curriculum.split('\n').length,10);
  assert.ok(read.brief.targetCustomer.includes('marketing'));assert.ok(read.brief.targetCustomer.includes('Chủ doanh nghiệp'));
  fs.writeFileSync('.tmp/lp-seo-editorial/read.json',JSON.stringify(read,null,2));
  const generated=await api(`/landing-pages/${entry.id}/ai-template-content`,{snapshot:before.draftSpec,sourceId:read.source.sourceId,brief:{...read.brief,goal:'consult',imageIds:[fixture.image.id],primaryImageId:fixture.image.id},idempotencyKey:randomUUID()});
  fs.writeFileSync('.tmp/lp-seo-editorial/generation.json',JSON.stringify(generated,null,2));
  const program=generated.proposals.filter(p=>{const slot=generated.slots.find(s=>s.id===p.slotId);return slot.blockType==='Features'&&slot.occurrence===0;}).map(p=>p.text||'').join(' ');
  const concepts=[['Google',/google|crawl|index|ranking/i],['Từ khóa',/từ khóa|từ khoá|keyword/i],['Entity',/entity|stacking/i],['Cấu trúc',/cấu trúc|silo|cluster/i],['Audit',/audit/i],['Onpage',/onpage/i],['Internal Link',/internal link|liên kết nội bộ/i],['Technical Schema',/technical|schema/i],['Traffic User',/traffic user/i],['Tổng kết',/tổng kết/i]];
  const coverage=concepts.map(([name,regex])=>({name,present:regex.test(program)}));
  const ready=generated.proposals.filter(p=>p.status==='ready'&&p.text);
  assert.ok(ready.length>30);assert.ok(ready.every(p=>p.text.length<=generated.slots.find(s=>s.id===p.slotId).maxLength));
  assert.doesNotMatch(ready.map(p=>p.text).join(' '),/Studio Sáng tạo|Trao đổi dự án|Lợi ích sản phẩm|cam kết lên top|học phí chỉ|lịch khai giảng ngày/i);
  const after=await api(`/landing-pages/${entry.id}`);assert.deepEqual(after.draftSpec,before.draftSpec);assert.equal(after.updatedAt,before.updatedAt);assert.equal(after.status,'DRAFT');
  const result={passed:coverage.every(c=>c.present),source:'https://daotaoseodigi.com/',sourceChars:read.source.text.length,sourceSections:read.source.sections.length,brand:read.brief.brandName,audiences:read.brief.targetCustomer,modules:read.brief.curriculum.split('\n').length,sourceMode:generated.source,aiSlots:generated.proposals.filter(p=>p.source==='ai').length,coverage,diagnostics:generated.validationSummary,draftUnchanged:true,published:false};
  fs.writeFileSync('.tmp/lp-seo-editorial/canary-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  assert.ok(result.passed,'All ten curriculum concepts must appear in the existing curriculum cards');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
