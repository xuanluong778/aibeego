// Optional provider canary; no page/database mutations. Uses the existing AI configuration.
const assert = require('node:assert/strict');
const path = require('node:path');
const shared = require('@marketingspa/shared');
const apiRoot = process.env.LP_API_DIST || path.resolve('apps/api/dist');
const { LandingPageAiService } = require(path.join(apiRoot, 'landing-pages/landing-page-ai.service.js'));
const { OpenAiService } = require(path.join(apiRoot, 'openai/openai.service.js'));
(async () => {
  if (process.env.LP_TEMPLATE_LIVE_AI !== '1') throw new Error('Set LP_TEMPLATE_LIVE_AI=1 to run the optional provider call.');
  const openai = new OpenAiService({ get: key => process.env[key] });
  if (!openai.isConfigured()) { console.log(JSON.stringify({ skipped: true, reason: 'Provider not configured' })); return; }
  const template = shared.LANDING_PAGE_SYSTEM_TEMPLATES.find(t => t.slug === 'product-launch');
  const slots = shared.collectTemplateContentSlots(template.spec).filter(slot => slot.blockType === 'Hero' || slot.blockType === 'Benefits');
  const brief = { productName: 'Bình giữ nhiệt 500 ml', brandName: 'An Nhiên', description: 'Dung tích 500 ml\nCó nắp khóa', targetCustomer: 'Nhân viên văn phòng', goal: 'consult', imageIds: [] };
  const result = await new LandingPageAiService(openai).generateTemplateContent(slots, brief);
  assert.equal(result.source, 'ai');
  for (const proposal of result.proposals) if (proposal.text) assert.equal(shared.isGroundedTemplateText(proposal.text, brief, slots.find(slot => slot.id === proposal.slotId)), true);
  assert.ok(result.proposals.some(proposal => proposal.status === 'missing'));
  console.log(JSON.stringify({ passed: true, source: result.source, slots: slots.length, ready: result.proposals.filter(p => p.status === 'ready').length, missing: result.proposals.filter(p => p.status === 'missing').length, noPageWrites: true }));
})().catch(error => { console.error(error.name); process.exitCode = 1; });
