const assert = require('node:assert/strict');
const { OpenAiService } = require(process.env.OPENAI_SERVICE_PATH || '../apps/api/dist/openai/openai.service.js');

async function main() {
  const originalFetch = global.fetch;
  const bodies = [];
  global.fetch = async (_url, request) => {
    bodies.push(JSON.parse(request.body));
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }] }) };
  };
  try {
    const service = new OpenAiService({ get: key => key === 'OPENAI_API_KEY' ? 'synthetic-test-key' : undefined });
    for (const method of ['chatCompletion', 'chatCompletionWithTools']) {
      for (const format of ['json_object', 'text', undefined]) {
        await service[method]({ messages: [{ role: 'user', content: 'Synthetic test' }], responseFormat: format });
        const body = bodies.at(-1);
        if (format) assert.deepEqual(body.response_format, { type: format }, `${method}: provider must receive ${format}`);
        else assert.equal(Object.hasOwn(body, 'response_format'), false, `${method}: keep provider default when unspecified`);
      }
    }
    console.log('PASS: JSON/text format forwarded by both chat methods; default preserved (6 cases)');
  } finally { global.fetch = originalFetch; }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
