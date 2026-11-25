// Run in an API image. Actual controller, guards, multipart parser and bulk service;
// fixture persistence only, never connects to the application database.
const assert = require('node:assert/strict');
const req = require('node:module').createRequire('/app/package.json');
req('reflect-metadata');
const { Module } = req('@nestjs/common');
const { NestFactory } = req('@nestjs/core');
const { LandingPagesController } = req('/app/dist/landing-pages/landing-pages.controller');
const { LandingPagesService } = req('/app/dist/landing-pages/landing-pages.service');
const { LandingPageTemplatePackService } = req('/app/dist/landing-pages/landing-page-template-pack.service');
const { PlatformAdminGuard } = req('/app/dist/common/guards/platform-admin.guard');
const pack = req('/app/dist/landing-pages/template-pack');

async function main() {
  const handler = LandingPagesController.prototype.importTemplatePacksBulk;
  assert.equal(Reflect.getMetadata('path', handler), 'templates/packs/bulk');
  assert(Reflect.getMetadata('__guards__', handler).includes(PlatformAdminGuard));
  Reflect.defineMetadata('__guards__', [], LandingPagesController);
  const saved = [];
  const service = new LandingPageTemplatePackService({ landingPageTemplate: {
    findFirst: async ({ where }) => where.slug === 'bulk-existing' ? { id: 'fixture' } : null,
  } });
  service.importNew = async (_, file) => {
    const parsed = service.parseUpload(file);
    saved.push(parsed.manifest.slug);
    return { slug: parsed.manifest.slug };
  };
  service.importUpdate = async (_, slug, file) => {
    assert.equal(service.parseUpload(file).manifest.slug, slug);
    saved.push(slug);
    return { slug };
  };
  class FixtureModule {}
  Module({ controllers: [LandingPagesController], providers: [
    { provide: LandingPagesService, useValue: {} },
    { provide: LandingPageTemplatePackService, useValue: service },
  ] })(FixtureModule);
  const app = await NestFactory.create(FixtureModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.use((request, response, next) => {
    if (request.headers['x-fixture-role']) request.user = {
      id: 'fixture', organizationId: 'fixture', role: request.headers['x-fixture-role'],
    };
    next();
  });
  await app.listen(0, '0.0.0.0');
  const url = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1/landing-pages/templates/packs/bulk`;
  const post = async (files, role = 'SUPER_ADMIN') => {
    const body = new FormData();
    for (const [name, buffer] of files) body.append('files', new Blob([buffer]), name);
    const response = await fetch(url, { method: 'POST', headers: role ? { 'x-fixture-role': role } : {}, body });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await post([], null)).status, 403);
    assert.equal((await post([], 'OWNER')).status, 403);
    assert.equal(saved.length, 0);
    assert.equal((await post([])).status, 400);
    const html = Buffer.from('<!doctype html><html><head><title>Fixture</title></head><body><h1>Fixture</h1></body></html>');
    const mixed = await post([['fixture.html', html], ['bad.zip', Buffer.from('invalid')]]);
    assert.equal(mixed.status, 201);
    assert.equal(mixed.body.created, 1);
    assert.equal(mixed.body.failed, 1);
    const template = req('@marketingspa/shared').createBlankLandingPageSpec();
    const inner = slug => pack.buildStoredZip([
      { name: 'manifest.json', data: Buffer.from(JSON.stringify({ format: pack.TEMPLATE_PACK_FORMAT,
        formatVersion: pack.TEMPLATE_PACK_FORMAT_VERSION, slug, name: slug, category: 'agency', theme: 'MODERN', tags: [] })) },
      { name: 'template.json', data: Buffer.from(JSON.stringify(template)) },
    ]);
    const bundle = pack.buildStoredZip([
      { name: 'packs/bulk-existing.zip', data: inner('bulk-existing') },
      { name: 'packs/bulk-new.zip', data: inner('bulk-new') },
      { name: 'README.md', data: Buffer.alloc(21 * 1024 * 1024, 0x61) },
    ]);
    const imported = await post([['bundle.zip', bundle]]);
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    assert.equal(imported.body.created, 1);
    assert.equal(imported.body.updated, 1);
    assert.equal(imported.body.failed, 0);
    assert.equal((await post([['too-large.zip', Buffer.alloc(pack.TEMPLATE_BULK_MAX_ZIP_BYTES + 1)]])).status, 413);
    console.log('PASS: actual bulk route, admin guard, missing files, multipart HTML/ZIP, partial failure, nested bundle >20 MiB, create/update, 256 MiB limit; no database writes.');
  } finally { await app.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
