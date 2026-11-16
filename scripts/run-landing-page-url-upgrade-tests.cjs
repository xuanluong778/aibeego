// Run source regressions using the project's installed dependencies, without a database or AI calls.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const localCompiler = path.resolve(__dirname, '../.tmp/work-qa-typescript.cjs');
const ts = require(process.env.LP_TYPESCRIPT_MODULE || (fs.existsSync(localCompiler) ? localCompiler : 'typescript'));
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  if (request === '@marketingspa/shared') request = path.join(root, 'packages/shared/src/index.ts');
  else if (request.startsWith('@marketingspa/shared/dist/'))
    request = path.join(root, 'packages/shared/src', request.slice('@marketingspa/shared/dist/'.length) + '.ts');
  if (path.isAbsolute(request) && request.endsWith('.js') && !fs.existsSync(request) && fs.existsSync(request.slice(0, -3) + '.ts'))
    request = request.slice(0, -3) + '.ts';
  try { return resolve.call(this, request, parent, ...args); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' || request.startsWith('.') || path.isAbsolute(request)) throw error;
    const paths = ['shared', 'database'].map(name => fs.realpathSync(path.join(root, 'node_modules/@marketingspa', name)));
    return resolve.call(this, request, parent, false, { paths });
  }
};
require.extensions['.ts'] = function (module, filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true },
    fileName: filename, reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: p => p, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
  module._compile(compiled.outputText, filename);
};
if (require.main === module) {
  const test = process.argv[2];
  if (!test || !/^test-landing-page-[\w-]+\.(?:ts|cjs)$/.test(test)) throw new Error('Supply a landing-page regression filename.');
  require(path.join(__dirname, test));
}
