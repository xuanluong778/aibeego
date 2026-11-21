// Explicit opt-in. Sends ONLY the synthetic fixture below, never DB/customer data.
if (process.env.RAG_LIVE_AI_QA !== '1') throw new Error('Set RAG_LIVE_AI_QA=1 explicitly.');
const assert = require('node:assert/strict');
const { OpenAiService } = require('../apps/api/dist/openai/openai.service');
const { ConfigService } = require('../apps/api/node_modules/@nestjs/config');
const { replyFromRag } = require('../apps/api/dist/rag-kb/rag-grounded-reply');
const ai = new OpenAiService(new ConfigService());
if (!ai.isConfigured()) throw new Error('AI credentials are not configured; live test skipped.');
const content = 'Doanh nghiệp QA hoàn toàn giả lập. Khóa học SEO Basic có học phí 6.000.000 đồng. Ưu đãi giảm 10% áp dụng đến 30/11/2026. Đây chỉ là dữ liệu kiểm thử, không phải khóa học đang bán.';
const fixture = { mode: 'text', knowledgeBaseId: 'synthetic-kb', hits: [{ chunkId: 'synthetic-doc:0', documentId: 'synthetic-doc', knowledgeBaseId: 'synthetic-kb', knowledgeBaseName: 'Synthetic QA', title: 'Dữ liệu kiểm thử giả lập', content, url: 'https://example.com/synthetic-qa', updatedAt: new Date('2026-11-20T00:00:00Z'), documentVersion: new Date('2026-11-20T00:00:00Z'), score: 1 }] };
(async () => {
  const result = await replyFromRag({ packet: fixture, text: 'Theo dữ liệu kiểm thử, học phí SEO Basic và thời hạn ưu đãi là gì?', history: [], settings: { model: ai.getDefaultModel(), temperature: 0.1 }, chat: input => ai.chatCompletion({ model: input.model, responseFormat: input.responseFormat, maxTokens: 1000, temperature: 0.1, messages: [{ role: 'system', content: input.systemPrompt }, { role: 'user', content: input.userText }] }) });
  assert(result.usedAi, result.blockedCode);
  assert(result.reply.includes('6.000.000'));
  assert(result.reply.includes('30/11/2026'));
  assert(result.evidence.length > 0);
  console.log('PASS: live AI selected valid citations for synthetic tuition/offer-date facts; no customer data sent');
})().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : 'Live AI test failed; check provider connectivity/configuration.'); process.exitCode = 1; });
