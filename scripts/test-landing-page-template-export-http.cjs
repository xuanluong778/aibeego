// Run inside the built API image: node /tmp/test-template-export.cjs
// Exercises the actual controller and admin guard with isolated fixture data.
const assert = require('node:assert/strict');
const req = require('node:module').createRequire('/app/package.json');
req('reflect-metadata');
const { Module } = req('@nestjs/common');
const { NestFactory } = req('@nestjs/core');
const { LandingPagesController } = req('/app/dist/landing-pages/landing-pages.controller');
const { LandingPagesService } = req('/app/dist/landing-pages/landing-pages.service');
const { LandingPageTemplatePackService } = req('/app/dist/landing-pages/landing-page-template-pack.service');
const { PlatformAdminGuard } = req('/app/dist/common/guards/platform-admin.guard');
const { buildStoredZip, readZip } = req('/app/dist/landing-pages/template-pack');

async function main() {
  const handler = LandingPagesController.prototype.exportAllTemplatePacks;
  assert.equal(Reflect.getMetadata('path', handler), 'templates/packs/export-all');
  assert(Reflect.getMetadata('__guards__', handler).includes(PlatformAdminGuard));
  // Authentication is supplied by the fixture middleware; retain the real method admin guard.
  Reflect.defineMetadata('__guards__', [], LandingPagesController);
  let calls = 0;
  const inner = buildStoredZip([{ name: 'template.json', data: Buffer.from('{"fixture":true}') }]);
  const body = buildStoredZip([{ name: 'packs/fixture.zip', data: inner }]);
  class FixtureModule {}
  Module({
    controllers: [LandingPagesController],
    providers: [
      { provide: LandingPagesService, useValue: {} },
      { provide: LandingPageTemplatePackService, useValue: {
        exportAll: async (user) => {
          assert.equal(user.role, 'SUPER_ADMIN');
          calls++;
          return { filename: 'all-landing-templates-fixture.zip', body, count: 1 };
        },
      } },
    ],
  })(FixtureModule);
  const app = await NestFactory.create(FixtureModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.use((request, response, next) => {
    if (request.headers['x-fixture-role']) request.user = {
      id: 'fixture', organizationId: 'fixture', role: request.headers['x-fixture-role'],
    };
    next();
  });
  await app.listen(0, '127.0.0.1');
  try {
    const url = `${await app.getUrl()}/api/v1/landing-pages/templates/packs/export-all`;
    assert.equal((await fetch(url)).status, 403);
    assert.equal((await fetch(url, { headers: { 'x-fixture-role': 'OWNER' } })).status, 403);
    assert.equal(calls, 0);
    const result = await fetch(url, { headers: { 'x-fixture-role': 'SUPER_ADMIN' } });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-type'), 'application/zip');
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(result.headers.get('content-disposition'), 'attachment; filename="all-landing-templates-fixture.zip"');
    const entries = readZip(Buffer.from(await result.arrayBuffer()), { bundle: true });
    assert.deepEqual([...entries.keys()], ['packs/fixture.zip']);
    assert(readZip(entries.get('packs/fixture.zip')).has('template.json'));
    assert.equal(calls, 1);
    console.log('PASS: actual export route returns a downloadable nested ZIP; admin guard and response headers verified.');
  } finally {
    await app.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
