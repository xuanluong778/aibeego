// Real production Builder UI, intercepted APIs and actual catalog/shared field patch functions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.LP_PLAYWRIGHT_MODULE || 'playwright');
const shared = require(process.env.LP_SHARED_MODULE || '../packages/shared/dist');
const base = process.env.LP_TEMPLATE_QA_BASE || 'http://localhost:8080';
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.LP_CHROME_PATH ? { executablePath: process.env.LP_CHROME_PATH } : {}),
  });
  let checks = 0;
  fs.mkdirSync('.tmp/lp-template-content', { recursive: true });
  try {
    for (const slug of [
      'product-launch',
      'product-launch-trust-reviews',
      'agency-portfolio-cream-editorial',
    ]) {
      const pageId = slug.startsWith('agency-')
        ? '2a68892a-e811-4647-a29c-600827b46cc8'
        : 'qa-page';
      const template = shared.LANDING_PAGE_SYSTEM_TEMPLATES.find((t) => t.slug === slug);
      const original = shared.sanitizeLandingPagePersistSpec(template.spec);
      let stored = structuredClone(original),
        lastSnapshot,
        generateFail = false;
      const saves = [],
        generations = [],
        errors = [];
      const library = [
        {
          id: 'owned-photo',
          name: 'Ảnh sản phẩm thật',
          url: '/uploads/public/landing-pages/qa-org/qa-page/product.png',
        },
      ];
      const page = await browser.newPage({
        viewport: { width: slug.startsWith('agency-') ? 1534 : 1580, height: 1000 },
      });
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('dialog', (dialog) => dialog.accept());
      await page.addInitScript(() =>
        localStorage.setItem(
          'ms_access_token',
          `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`,
        ),
      );
      await page.route('**/uploads/**', (route) =>
        route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500" viewBox="0 0 700 500"><defs><linearGradient id="b"><stop stop-color="#173c23"/><stop offset=".45" stop-color="#386c46"/><stop offset="1" stop-color="#12351d"/></linearGradient></defs><rect width="700" height="500" fill="#f5efe4"/><ellipse cx="350" cy="455" rx="100" ry="15" fill="#0001"/><rect x="277" y="110" width="146" height="338" rx="48" fill="url(#b)"/><rect x="277" y="64" width="146" height="90" rx="27" fill="#244d30"/><rect x="330" y="95" width="40" height="65" rx="16" fill="#14351f" stroke="#6a8970" stroke-width="3"/><path d="M300 180v210" stroke="#ffffff15" stroke-width="8" stroke-linecap="round"/></svg>',
        }),
      );
      await page.route('**/api/v1/**', async (route) => {
        const request = route.request(),
          pathname = new URL(request.url()).pathname.replace('/api/v1', '');
        const reply = (json, status = 200) => route.fulfill({ status, json });
        if (pathname === '/auth/me')
          return reply({
            id: 'qa-user',
            name: 'QA',
            email: 'qa@example.test',
            role: 'OWNER',
            organizationId: 'qa-org',
            organization: { id: 'qa-org', name: 'QA', slug: 'qa' },
            employee: null,
            permissions: [],
          });
        if (pathname === '/billing/subscription')
          return reply({ hasPlan: true, status: 'ACTIVE', isExpired: false });
        if (pathname === '/landing-pages/business-profile') return reply({ brandName: 'An Nhiên' });
        if (pathname === `/landing-pages/${pageId}/media`) return reply({ items: library });
        if (pathname === `/landing-pages/${pageId}/upload-image`) {
          const uploaded = {
            id: 'uploaded-photo',
            name: 'Ảnh vừa tải',
            url: '/uploads/public/landing-pages/qa-org/qa-page/uploaded.png',
          };
          if (!library.some((image) => image.id === uploaded.id)) library.push(uploaded);
          return reply({ url: uploaded.url, originalName: uploaded.name });
        }
        if (pathname.endsWith('/ai-template-content/validate-images')) {
          const ids = request.postDataJSON().imageIds;
          assert.ok(ids.every((id) => library.some((image) => image.id === id)));
          return reply({ images: library.filter((image) => ids.includes(image.id)) });
        }
        if (pathname.endsWith('/ai-template-content')) {
          const body = request.postDataJSON();
          generations.push(body);
          lastSnapshot = body.snapshot;
          if (generateFail) {
            generateFail = false;
            return reply({ message: 'Không thể tạo nội dung lúc này. Hãy thử lại.' }, 503);
          }
          const slots = shared
            .collectTemplateContentSlots(body.snapshot)
            .filter((s) => !body.blockId || s.blockId === body.blockId);
          return reply({
            slots,
            proposals: shared.fallbackTemplateContent(slots, body.brief),
            protectedSlotIds: shared.protectedTemplateSlotIds(body.snapshot, original),
            images: library,
            source: 'fallback',
            warning: 'Kiểm thử với dữ liệu sản phẩm đã xác nhận.',
          });
        }
        if (pathname.endsWith('/autosave')) {
          const body = request.postDataJSON();
          saves.push(body);
          stored = body.draftSpec;
          return reply({
            updatedAt: new Date().toISOString(),
            requestId: body.requestId,
            clientRevision: body.clientRevision,
          });
        }
        if (pathname === `/landing-pages/${pageId}`)
          return reply({
            id: pageId,
            templateId: 'qa-template',
            name: template.name,
            slug: 'qa-template-content',
            status: 'DRAFT',
            draftSpec: stored,
          });
        if (request.method() !== 'GET') throw new Error(`Unexpected mutation ${pathname}`);
        return reply([]);
      });
      await page.goto(`${base}/landing-pages/builder/${pageId}`, { waitUntil: 'domcontentloaded' });
      assert.equal(
        (
          await page
            .getByRole('button', { name: 'Tạo nội dung cho mẫu bằng AI', exact: true })
            .innerText()
        ).trim(),
        'Tạo nội dung cho mẫu bằng AI',
      );
      checks++;
      const open = async () => {
        await page
          .getByRole('button', { name: 'Tạo nội dung cho mẫu bằng AI', exact: true })
          .click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Tên sản phẩm', { exact: false }).fill('Bình giữ nhiệt 500 ml');
        await dialog.getByLabel('Thương hiệu', { exact: false }).fill('An Nhiên');
        await dialog
          .getByLabel('Mô tả / đặc điểm', { exact: false })
          .fill('Dung tích 500 ml\nCó nắp khóa');
        await dialog
          .getByLabel('Khách hàng mục tiêu', { exact: false })
          .fill('Nhân viên văn phòng');
        await dialog.getByLabel('Mục tiêu trang').selectOption('consult');
        if (!library.some((image) => image.id === 'uploaded-photo')) {
          await dialog.getByLabel('Tải ảnh sản phẩm', { exact: true }).setInputFiles({
            name: 'binh.png',
            mimeType: 'image/png',
            buffer: Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
              'base64',
            ),
          });
          await dialog
            .getByRole('checkbox', { name: 'Chọn ảnh Ảnh vừa tải', exact: true })
            .waitFor();
          assert.equal(
            await dialog
              .getByRole('checkbox', { name: 'Chọn ảnh Ảnh vừa tải', exact: true })
              .isChecked(),
            true,
          );
          checks++;
        }
        await dialog
          .getByRole('checkbox', { name: 'Chọn ảnh Ảnh sản phẩm thật', exact: true })
          .check();
        await dialog
          .getByRole('radio', { name: 'Ảnh chính Ảnh sản phẩm thật', exact: true })
          .check();
        await dialog.getByRole('button', { name: 'Tạo đề xuất trên mẫu', exact: true }).click();
        await dialog.getByRole('heading', { name: 'Đề xuất theo khối', exact: true }).waitFor();
        return dialog;
      };
      let dialog = await open();
      const heroBlockId = lastSnapshot.blocks.find((block) => block.type === 'Hero').id;
      const heroReview = dialog.locator(`[data-template-content-block="${heroBlockId}"]`);
      if (!(await heroReview.getByRole('button', { expanded: true }).count()))
        await heroReview.getByRole('button', { expanded: false }).click();
      await heroReview
        .getByLabel(`Sửa Tiêu đề ${heroBlockId}::headline`, { exact: true })
        .fill('Bình giữ nhiệt dành cho bàn làm việc');
      await heroReview
        .getByLabel(`Đổi ảnh ${heroBlockId}::imageUrl`, { exact: true })
        .selectOption('uploaded-photo');
      assert.ok(
        (await dialog.locator('[data-template-content-preview]').innerText()).includes(
          'Bình giữ nhiệt dành cho bàn làm việc',
        ),
      );
      checks++;
      const beforeSaveCount = saves.length;
      await dialog.getByRole('button', { name: 'Mobile', exact: true }).click();
      await dialog.locator('[data-template-content-preview="mobile"]').waitFor();
      assert.equal(
        await dialog
          .locator('[data-lp-preview-viewport]')
          .evaluate((element) =>
            Math.round(
              element.getBoundingClientRect().width / Number(element.parentElement.style.zoom),
            ),
          ),
        390,
      );
      checks++;
      await page.screenshot({
        path: `.tmp/lp-template-content/${slug}-mobile-preview.png`,
        fullPage: true,
      });
      await dialog.getByRole('button', { name: 'Desktop', exact: true }).click();
      await dialog.locator('[data-template-content-preview="desktop"]').waitFor();
      checks++;
      assert.ok(await dialog.getByText('Cần bổ sung', { exact: true }).count());
      checks++;
      await page.screenshot({
        path: `.tmp/lp-template-content/${slug}-desktop-review.png`,
        fullPage: true,
      });
      await page.waitForTimeout(1400);
      assert.equal(saves.length, beforeSaveCount, 'Preview must not autosave');
      checks++;
      await dialog.getByRole('button', { name: 'Bỏ chọn tất cả', exact: true }).click();
      await dialog.getByRole('checkbox', { name: 'Chọn khối Đầu trang', exact: true }).check();
      const beforePartial = structuredClone(lastSnapshot);
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/autosave')),
        dialog.getByRole('button', { name: /^Áp dụng đã chọn/ }).click(),
      ]);
      assert.equal(await page.getByRole('dialog').count(), 0);
      const heroId = beforePartial.blocks.find((b) => b.type === 'Hero').id;
      for (const block of shared
        .sanitizeLandingPagePersistSpec(beforePartial)
        .blocks.filter((b) => b.id !== heroId))
        assert.equal(
          JSON.stringify(stored.blocks.find((b) => b.id === block.id)),
          JSON.stringify(block),
        );
      assert.ok(stored.blocks.find((b) => b.id === heroId).headline.includes('Bình giữ nhiệt'));
      checks++;
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/autosave')),
        page.locator('[data-lp-toolbar-btn="undo"]').click(),
      ]);
      assert.equal(
        stored.blocks.find((b) => b.id === heroId).headline,
        beforePartial.blocks.find((b) => b.id === heroId).headline,
      );
      checks++;
      dialog = await open();
      await dialog.getByRole('button', { name: 'Chọn đủ dữ liệu', exact: true }).click();
      const beforeAll = structuredClone(lastSnapshot);
      try {
        await Promise.all([
          page.waitForResponse((r) => r.url().endsWith('/autosave'), { timeout: 15000 }),
          dialog.getByRole('button', { name: /^Áp dụng đã chọn/ }).click(),
        ]);
      } catch (error) {
        console.error({
          slug,
          alerts: await page.getByRole('alert').allTextContents(),
          errors,
          saves: saves.map((s) => ({
            clientRevision: s.clientRevision,
            baseRevision: s.baseRevision,
          })),
          dialog: (await page.locator('.lp-template-ai-panel').innerText()).slice(0, 1800),
        });
        await page.screenshot({ path: '.tmp/lp-template-content/apply-error.png', fullPage: true });
        throw error;
      }
      assert.deepEqual(stored.themeTokens, beforeAll.themeTokens);
      assert.equal(stored.blocks.length, beforeAll.blocks.length);
      assert.ok(
        stored.blocks
          .find((b) => b.type === 'Benefits')
          .items.some((item) => item.title.includes('500 ml')),
      );
      checks++;
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/autosave')),
        page.locator('[data-lp-toolbar-btn="undo"]').click(),
      ]);
      assert.equal(
        JSON.stringify(stored.blocks),
        JSON.stringify(shared.sanitizeLandingPagePersistSpec(beforeAll).blocks),
      );
      checks++;
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/autosave')),
        page.locator('[data-lp-toolbar-btn="redo"]').click(),
      ]);
      const savedJson = JSON.stringify(stored.blocks);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page
        .getByRole('button', { name: 'Tạo nội dung cho mẫu bằng AI', exact: true })
        .waitFor();
      assert.equal(JSON.stringify(stored.blocks), savedJson);
      assert.ok(
        (await page.locator('[data-lp-canvas-root]').first().innerText()).includes(
          'Bình giữ nhiệt',
        ),
      );
      checks++;
      // Rewriting only one block uses the same proposal contract and leaves the draft alone.
      dialog = await open();
      const heroGroup = dialog.locator(`[data-template-content-block="${heroId}"]`);
      if (!(await heroGroup.getByRole('button', { expanded: true }).count()))
        await heroGroup.getByRole('button', { expanded: false }).click();
      const generated = page.waitForResponse((r) => r.url().endsWith('/ai-template-content'));
      await heroGroup.getByRole('button', { name: 'Viết lại khối', exact: true }).click();
      await generated;
      assert.equal(generations.at(-1).blockId, heroId);
      assert.equal(JSON.stringify(stored.blocks), savedJson);
      checks++;
      generateFail = true;
      const failed = page.waitForResponse((r) => r.url().endsWith('/ai-template-content'));
      await heroGroup.getByRole('button', { name: 'Viết lại khối', exact: true }).click();
      await failed;
      await dialog.getByRole('alert').waitFor();
      assert.equal(JSON.stringify(stored.blocks), savedJson);
      checks++;
      await page.setViewportSize({ width: 390, height: 844 });
      await dialog.getByRole('button', { name: 'Mobile', exact: true }).click();
      await page.screenshot({
        path: `.tmp/lp-template-content/${slug}-phone-review.png`,
        fullPage: true,
      });
      await dialog.getByRole('button', { name: 'Đóng tạo nội dung cho mẫu', exact: true }).click();
      assert.deepEqual(errors, []);
      checks++;
      await page.close();
    }
    console.log(
      JSON.stringify({
        passed: true,
        checks,
        templates: [
          'product-launch',
          'product-launch-trust-reviews',
          'agency-portfolio-cream-editorial',
        ],
        provider: 'fixture',
        APIs: 'intercepted',
        productionBuilder: true,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
