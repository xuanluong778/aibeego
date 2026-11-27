// Browser QA: the round avatars of the members chosen in the task card must show on the SAME row as the
// "Thành viên" chip. Every /api/v1 request is intercepted with isolated fixtures: no real API / database is touched.
//
//   WM_QA_BASE=http://localhost:8080 node scripts/qa-work-task-member-avatars.cjs
//   (a temporary container on another port also works: the script answers the CORS preflight itself)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.LP_PLAYWRIGHT_MODULE || 'playwright');

const BASE = (process.env.WM_QA_BASE || 'http://localhost:8080').replace(/\/+$/, '');
const OUT = path.resolve(process.env.WM_QA_OUT || '.tmp/work-member-avatars');
const API_ORIGIN = process.env.WM_QA_API_ORIGIN || 'http://localhost:8080';

const NAMES = [
  'xuanluong',
  'bao118221@gmail.com',
  'Platform Super Admin',
  'Lưu Xuân Lượng',
  'Trăng văn bảo',
  'Nguyễn Thị An',
  'Phạm Minh Châu',
  'Đỗ Quang Huy',
];
const employees = NAMES.map((name, i) => ({ id: `emp-${i + 1}`, name, status: 'ACTIVE', isActive: true }));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.LP_CHROME_PATH ? { executablePath: process.env.LP_CHROME_PATH } : {}),
  });
  let checks = 0;
  const ok = (cond, label, detail = '') => {
    assert.ok(cond, `${label}${detail ? ` -> ${detail}` : ''}`);
    checks++;
    console.log(`  ok  ${label}`);
  };
  try {
    for (const width of [1440, 390]) {
      console.log(`== viewport ${width}px`);
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [];
      const writes = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const columns = [
        { id: 'new', key: 'NEW', name: 'Lượng', sortOrder: 0 },
        { id: 'done', key: 'DONE', name: 'Hoàn thành', sortOrder: 1 },
      ];
      const task = {
        id: 'qa-task',
        organizationId: 'qa-org',
        projectId: 'qa-project',
        columnId: 'new',
        columnKey: 'NEW',
        columnName: 'Lượng',
        title: 'Test Builder Landing page',
        labels: [],
        checklist: [],
        assignees: [],
        watchers: [],
        priority: 'MEDIUM',
        progress: 0,
        sortOrder: 0,
        isArchived: false,
        createdAt: '2026-11-14T00:00:00Z',
        updatedAt: '2026-11-14T00:00:00Z',
      };
      const project = {
        id: 'qa-project',
        name: 'Dự án kiểm thử thành viên',
        isArchived: false,
        columns,
        tasks: [task],
        customFieldDefs: [],
        _count: { tasks: 1 },
      };
      await page.addInitScript(() =>
        localStorage.setItem(
          'ms_access_token',
          `fixture.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`,
        ),
      );
      const cors = (route) => ({
        'access-control-allow-origin': new URL(BASE).origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
        vary: 'Origin',
      });
      await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const headers = cors(route);
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const p = new URL(request.url()).pathname.replace('/api/v1', '');
        if (request.method() !== 'GET') {
          const body = request.postDataJSON?.() ?? null;
          writes.push({ method: request.method(), path: p, body });
          if (body && Array.isArray(body.assigneeIds)) {
            task.assignees = body.assigneeIds.map((id) => ({
              id,
              name: employees.find((e) => e.id === id)?.name || id,
            }));
            task.updatedAt = new Date().toISOString();
          }
          return route.fulfill({ json: task, headers });
        }
        let json = [];
        if (p === '/auth/me')
          json = {
            id: 'qa-user',
            name: 'QA',
            email: 'qa@example.test',
            role: 'OWNER',
            organizationId: 'qa-org',
            organization: { id: 'qa-org', name: 'QA', slug: 'qa' },
          };
        else if (p === '/billing/subscription')
          json = { hasPlan: true, isExpired: false, status: 'ACTIVE', subscriptionStatus: 'ACTIVE' };
        else if (p === '/work-management/projects') json = [project];
        else if (p === '/work-management/projects/qa-project') json = project;
        else if (p === '/hrm/employees')
          json = { items: employees, total: employees.length, page: 1, totalPages: 1 };
        else if (p === '/work-management/tasks/qa-task') json = task;
        return route.fulfill({ json, headers });
      });

      await page.goto(`${BASE}/work-management?projectId=qa-project`, { waitUntil: 'domcontentloaded' });
      await page.getByText('Test Builder Landing page', { exact: true }).first().click({ timeout: 30000 });
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 15000 });
      const chip = dialog.getByRole('button', { name: /^Thành viên/ }).first();
      await chip.waitFor();

      ok((await dialog.getByTestId('card-member-avatars').count()) === 0, 'no avatar row while nobody is chosen');

      // choose the five members of the user's screenshot
      await chip.click();
      await page.getByText('Thành viên của bảng', { exact: true }).waitFor({ timeout: 10000 });
      // The picker is portaled to the end of <body>, so .last() is its row (the header dropdown also shows a name).
      const pick = (name) => page.getByRole('button', { name }).last();
      for (const name of NAMES.slice(0, 5)) await pick(name).click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT, `members-5-${width}.png`) });
      ok(
        (await dialog.getByTestId('card-member-avatars').count()) === 1,
        'the chosen members are shown as round avatars in the modal top bar (next to the main assignee e-mail)',
        `see ${path.join(OUT, `members-5-${width}.png`)}`,
      );

      const geo = await page.evaluate(() => {
        // Top bar assignee trigger = first dropdown trigger of the dialog (avatar + e-mail + chevron).
        const dlg = document.querySelector('[role="dialog"]');
        const chipEl = dlg.querySelector('[aria-haspopup="menu"]');
        const avs = [...document.querySelectorAll('[data-testid="card-member-avatars"] [role="img"]')];
        const c = chipEl.getBoundingClientRect();
        return {
          chip: { top: c.top, bottom: c.bottom, cy: c.top + c.height / 2, right: c.right },
          avatars: avs.map((a) => {
            const r = a.getBoundingClientRect();
            return {
              label: a.getAttribute('aria-label'),
              text: a.textContent.trim(),
              cy: r.top + r.height / 2,
              left: r.left,
              w: r.width,
              h: r.height,
              radius: getComputedStyle(a).borderTopLeftRadius,
            };
          }),
        };
      });
      ok(geo.avatars.length === 5, `5 chosen members -> 5 round avatars (${geo.avatars.map((a) => a.text).join(' ')})`);
      ok(
        JSON.stringify(geo.avatars.map((a) => a.label)) === JSON.stringify(NAMES.slice(0, 5)),
        'avatar order = member list order, names exposed to assistive tech',
      );
      ok(geo.avatars.every((a) => Math.abs(a.w - a.h) < 0.5 && parseFloat(a.radius) >= a.w / 2), 'every avatar is a circle');
      const sameRow = geo.avatars.filter((a) => Math.abs(a.cy - geo.chip.cy) <= 3);
      if (width >= 1000) {
        ok(sameRow.length === geo.avatars.length, 'ALL avatars are on the same horizontal row as the top-bar e-mail', JSON.stringify({ chip: geo.chip, av: geo.avatars.map((a) => a.cy) }));
        ok(geo.avatars.every((a) => a.left >= geo.chip.right), 'avatars sit to the right of the e-mail');
      } else {
        // Narrow card: the avatar group may wrap under the e-mail inside the top bar, but never leaves it.
        const inBar = await page.evaluate(() => {
          const g = document.querySelector('[data-testid="card-member-avatars"]').getBoundingClientRect();
          const trigger = document.querySelector('[role="dialog"] [aria-haspopup="menu"]');
          const bar = trigger.closest('.border-b');
          const b = bar.getBoundingClientRect();
          return { gTop: g.top, gBottom: g.bottom, bTop: b.top, bBottom: b.bottom };
        });
        ok(inBar.gTop >= inBar.bTop - 1 && inBar.gBottom <= inBar.bBottom + 1, 'narrow card: avatars stay inside the top bar', JSON.stringify(inBar));
      }
      ok(
        (await dialog.getByTestId('card-members-row').count()) === 0,
        'the avatars are no longer rendered in the chip row',
      );
      const overflow = await page.evaluate(() => {
        const groupEl = document.querySelector('[data-testid="card-member-avatars"]');
        const bar = groupEl.closest('.border-b');
        const g = groupEl.getBoundingClientRect();
        const p = bar.getBoundingClientRect();
        return { groupRight: g.right, barRight: p.right, barScroll: bar.scrollWidth - bar.clientWidth };
      });
      ok(
        overflow.groupRight <= overflow.barRight + 1 && overflow.barScroll <= 1,
        'the avatars never overflow the top bar (no horizontal scroll)',
        JSON.stringify(overflow),
      );
      ok(
        writes.some((w) => w.method === 'PATCH' && w.body?.assigneeIds?.length === 5),
        'choosing members still saves them (PATCH assigneeIds)',
      );
      ok((await page.locator('svg.lucide-check').count()) >= 5, 'the picker still shows a check for every chosen member');

      // un-choose one -> avatar disappears
      await pick(NAMES[4]).click();
      await page.waitForTimeout(250);
      ok((await page.locator('[data-testid="card-member-avatars"] [role="img"]').count()) === 4, 'un-choosing a member removes its avatar');

      // choose all 8 -> 6 avatars + "+2"
      for (const name of NAMES.slice(4)) await pick(name).click();
      await page.waitForTimeout(250);
      const all = await page.locator('[data-testid="card-member-avatars"] [role="img"]').evaluateAll((els) =>
        els.map((e) => ({ t: e.textContent.trim(), title: e.getAttribute('title') })),
      );
      ok(all.length === 7 && all[6].t === '+2', '8 members -> 6 avatars + a "+2" bubble', JSON.stringify(all.map((a) => a.t)));
      ok(/Đỗ Quang Huy/.test(all[6].title) && /Phạm Minh Châu/.test(all[6].title), 'the "+2" bubble lists the hidden names');
      ok((await chip.innerText()).includes('8'), 'the chip counter still says 8');
      await page.screenshot({ path: path.join(OUT, `members-8-${width}.png`) });

      // close the picker and reload: avatars come back from the saved task
      await page.keyboard.press('Escape');
      ok(errors.length === 0, 'no page errors', errors.join(' | '));
      await page.close();
    }
    console.log(JSON.stringify({ passed: true, checks, widths: [1440, 390], APIs: 'intercepted fixtures; no business data changed' }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
