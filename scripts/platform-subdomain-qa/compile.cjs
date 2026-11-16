// Transpile isolated API files without loading the entire 600k-line Prisma type graph.
// Strict checking for the domain core is a separate required check.
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const src = path.join(root, 'apps/api/src'), out = path.join(root, 'apps/api/dist');
let count = 0;
function visit(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) visit(file);
    else if (item.name.endsWith('.ts') && !item.name.endsWith('.d.ts')) {
      const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true } });
      const errors = (result.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error);
      if (errors.length) throw Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: () => root, getCanonicalFileName: x => x, getNewLine: () => '\n' }));
      const dest = path.join(out, path.relative(src, file)).replace(/\.ts$/, '.js');
      fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, result.outputText); count++;
    }
  }
}
visit(src);
console.log(`Transpiled ${count} API files into isolated worktree dist.`);
