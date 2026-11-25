const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tmp/template-bulk-route-fix-20261122');
fs.mkdirSync(dir, { recursive: true });
const source = fs.readFileSync(path.join(root, 'apps/api/src/landing-pages/landing-pages.controller.ts'), 'utf8');
const result = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
}, reportDiagnostics: true });
if (result.diagnostics?.length) throw Error(ts.formatDiagnosticsWithColorAndContext(result.diagnostics, {
  getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n',
}));
fs.writeFileSync(path.join(dir, 'landing-pages.controller.js'), result.outputText);
fs.copyFileSync(path.join(root, 'scripts/test-landing-page-template-bulk-route-http.cjs'), path.join(dir, 'bulk-route-test.cjs'));
fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM aibeego-api:subscription-tiers-20261122\nCOPY landing-pages.controller.js /app/dist/landing-pages/landing-pages.controller.js\nCOPY bulk-route-test.cjs /tmp/bulk-route-test.cjs\n');
console.log('Prepared controller-only API overlay and HTTP regression test.');
