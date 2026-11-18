// Targeted web diagnostics: the existing repository skips type errors during Next builds.
const ts = require('typescript');
const path = require('node:path');
const configPath = path.resolve('apps/web/tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
const files = [
  'apps/web/src/components/landing-pages/landing-page-template-content-dialog.tsx',
  'apps/web/src/components/landing-pages/landing-page-price-comparison.tsx',
  'apps/web/src/components/landing-pages/landing-page-countdown.tsx',
  'apps/web/src/components/landing-pages/landing-page-renderer.tsx',
  'apps/web/src/components/landing-pages/landing-page-registration-layout.ts',
  'apps/web/src/components/landing-pages/public-landing-page-client.tsx',
  'apps/web/src/components/landing-pages/landing-page-agency-portfolio-blocks.tsx',
  'apps/web/src/components/landing-pages/landing-page-section-library-v2.tsx',
  'apps/web/src/components/landing-pages/landing-page-industry-extras.tsx',
  'apps/web/src/components/landing-pages/landing-page-website-blocks.tsx',
  'packages/shared/src/landing-page-template-content-review.ts',
  'packages/shared/src/landing-page-template-pricing.ts',
].map(p => path.resolve(p));
const program = ts.createProgram(files, { ...parsed.options, noEmit: true, incremental: false });
const diagnostics = ts.getPreEmitDiagnostics(program);
const target = new Set(files);
const own = diagnostics.filter(d => !d.file || target.has(path.resolve(d.file.fileName)));
if (own.length) console.error(ts.formatDiagnosticsWithColorAndContext(own, { getCanonicalFileName: p => p, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: () => '\n' }));
console.log(JSON.stringify({ targetedFiles: files.length, errors: own.length, otherDependencyDiagnostics: diagnostics.length - own.length }));
if (process.argv.includes('--details')) console.log(JSON.stringify(diagnostics.filter(d => d.file && !target.has(path.resolve(d.file.fileName))).map(d => ({ file: path.relative(process.cwd(), d.file.fileName), code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') })), null, 2));
process.exitCode = own.length ? 1 : 0;
