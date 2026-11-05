const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
function assertLandingPageBuilderSource(root = path.join(__dirname, '..')) {
  const base = path.join(root, 'apps/web/src/components/landing-pages');
  for (const [file, markers] of Object.entries({
    'landing-page-builder.tsx': [
      'LandingPageElementLibraryModal',
      'sectionInsertCommitRef',
      'LandingPageBuilderVersionNotice',
    ],
    'landing-page-text-library.tsx': ['data-lp-text-library-card', 'data-lp-text-category'],
    'landing-page-sidebar-drop-indicator.tsx': ['data-lp-drop-bar', 'data-lp-drop-orientation'],
    'landing-page-draft-recovery.ts': ['landingDraftsHaveSameContent', 'serverSpec'],
    'landing-page-builder-version-notice.tsx': ['/landing-page-builder-version.json', 'Để sau'],
  })) {
    const source = fs.readFileSync(path.join(base, file), 'utf8');
    for (const marker of markers)
      assert(
        source.includes(marker),
        `Builder release missing ${file}: ${marker}. Sync current Builder source before building.`,
      );
  }
  assert(
    !fs
      .readFileSync(path.join(base, 'landing-page-builder.tsx'), 'utf8')
      .includes('Chọn một mẫu bên phải để chèn vào vị trí thả'),
    'Refusing old sidebar-only picker implementation',
  );
}
function assertLandingPageBuilderBundle(dir) {
  const chunks = [];
  function walk(p) {
    for (const f of fs.readdirSync(p, { withFileTypes: true })) {
      const n = path.join(p, f.name);
      if (f.isDirectory()) walk(n);
      else if (n.endsWith('.js')) chunks.push(fs.readFileSync(n, 'utf8'));
    }
  }
  walk(path.join(dir, 'static/chunks'));
  const code = chunks.join('\n');
  for (const marker of [
    'data-lp-element-library-modal',
    'data-lp-text-library-card',
    'data-lp-drop-bar',
    'data-lp-builder-version-notice',
  ])
    assert(code.includes(marker), `Release artifact missing Builder marker ${marker}`);
}
module.exports = { assertLandingPageBuilderSource, assertLandingPageBuilderBundle };
if (require.main === module) {
  assertLandingPageBuilderSource();
  if (process.argv[2]) assertLandingPageBuilderBundle(path.resolve(process.argv[2]));
  console.log('PASS current Builder source/release features');
}
