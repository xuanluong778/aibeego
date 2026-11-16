// Serve scripts/fixtures/landing-page-mobile-audit.tsx in a disposable Next instance only.
const fs = require("node:fs");
const { chromium } = require(process.env.LP_PLAYWRIGHT_MODULE || "playwright");
const modes = process.argv.includes("--baseline")
  ? [{ width: 390, preview: true }]
  : [
      { width: 320, preview: false },
      { width: 375, preview: false },
      { width: 430, preview: false },
      { width: 390, preview: true },
    ];
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/v1/**", (r) => r.fulfill({ status: 200, json: {} }));
  await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
  await page.goto(
    process.env.LP_MOBILE_QA_URL || "http://127.0.0.1:3111/lp-mobile-audit-qa",
    { timeout: 180000, waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(() => window.__lpAudit);
  await page.addStyleTag({
    content:
      "[data-lp-canvas-root] *{animation:none!important;transition:none!important}",
  });
  const catalog = await page.evaluate(() => window.__lpAudit.catalog);
  const slugs = process.argv.includes("--baseline")
    ? [
        "draft",
        "clock:amethyst-flip",
        "clock:cyan-grid",
        "clock:emerald-halo",
        "product-launch",
        "agency-portfolio-cream-editorial",
      ]
    : catalog
        .map((t) => t.slug)
        .concat([
          "draft",
          ...[
            "boxes",
            "inline",
            "minimal",
            "silver-minimal",
            "opal-ribbon",
            "cobalt-orbit",
            "amethyst-flip",
            "champagne-editorial",
            "cyan-grid",
            "emerald-halo",
            "copper-ember",
            "rose-glass",
            "lime-terminal",
          ].map((s) => "clock:" + s),
        ]);
  const results = [];
  try {
    for (const mode of modes) {
      await page.setViewportSize({
        width: mode.preview ? 1440 : mode.width,
        height: 1000,
      });
      for (const slug of slugs) {
        await page.evaluate((s) => window.__lpAudit.render(s), {
          slug,
          width: mode.width,
          preview: mode.preview,
          viewport: "mobile",
        });
        await page.waitForFunction(
          (s) =>
            document
              .querySelector("[data-qa-slug]")
              ?.getAttribute("data-qa-slug") === s,
          slug,
        );
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        const row = await page.evaluate(() => {
          const root = document.querySelector("[data-lp-canvas-root]");
          const rr = root.getBoundingClientRect();
          const bad = [];
          for (const el of root.querySelectorAll(
            "h1,h2,h3,p,a,button,input,textarea,select,[data-lp-inline-field],.lp-cd-digit",
          )) {
            const r = el.getBoundingClientRect(),
              s = getComputedStyle(el);
            if (
              !r.width ||
              !r.height ||
              s.visibility === "hidden" ||
              s.opacity === "0"
            )
              continue;
            let carousel = false;
            for (
              let p = el.parentElement;
              p && p !== root;
              p = p.parentElement
            ) {
              if (["auto", "scroll"].includes(getComputedStyle(p).overflowX)) {
                carousel = true;
                break;
              }
            }
            if (carousel) continue;
            const outside = r.left < rr.left - 2 || r.right > rr.right + 2;
            const clipped =
              el.scrollWidth > el.clientWidth + 3 &&
              s.display !== "inline" &&
              el.clientWidth > 0;
            if (outside || clipped)
              bad.push({
                tag: el.tagName,
                field: el.getAttribute("data-lp-inline-field"),
                class: el.className?.toString().slice(0, 100),
                text: el.textContent?.slice(0, 70),
                x: Math.round(r.left - rr.left),
                w: Math.round(r.width),
                scroll: el.scrollWidth,
                client: el.clientWidth,
                outside,
                clipped,
              });
          }
          const clock =
            root.querySelector("[data-lp-countdown-clock]") ||
            root.querySelector('[aria-live="polite"]');
          const cells = clock
            ? [...clock.children].map((e) => {
                const r = e.getBoundingClientRect();
                return { x: r.x, y: r.y, w: r.width, h: r.height };
              })
            : [];
          const price = root.querySelector(".lp-countdown-price");
          const boxClock = root.querySelector(
            '[data-lp-countdown-clock="boxes"]',
          );
          if (boxClock) {
            const units = [
              ...boxClock.querySelectorAll("[data-lp-countdown-unit]"),
            ];
            if (
              new Set(
                units.map((e) => Math.round(e.getBoundingClientRect().top)),
              ).size > 1
            )
              bad.push({ reason: "Clock units wrap into separate rows" });
          }
          for (const clock of root.querySelectorAll(".lp-cd-clock")) {
            const units = [
              ...clock.querySelectorAll("[data-lp-countdown-unit]"),
            ];
            if (
              new Set(
                units.map((e) => Math.round(e.getBoundingClientRect().top)),
              ).size > 1
            )
              bad.push({
                reason: "Launch clock units wrap",
                style: clock.getAttribute("data-clock"),
              });
          }
          if (
            price &&
            price.clientHeight >
              parseFloat(getComputedStyle(price).lineHeight) * 1.4
          )
            bad.push({
              reason: "Price splits across lines",
              text: price.textContent,
            });
          for (const card of root.querySelectorAll(
            'form[data-lp-form-surface="card"]',
          )) {
            if (
              card.getBoundingClientRect().width &&
              parseFloat(getComputedStyle(card).paddingLeft) < 12
            )
              bad.push({
                reason: "Form content touches card border",
                padding: getComputedStyle(card).padding,
              });
          }
          for (const input of root.querySelectorAll(
            "input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select",
          )) {
            const r = input.getBoundingClientRect();
            if (
              r.width &&
              r.height &&
              parseFloat(getComputedStyle(input).fontSize) < 16
            )
              bad.push({
                reason: "Input font triggers iOS zoom",
                font: getComputedStyle(input).fontSize,
              });
          }
          return {
            rootWidth: rr.width,
            bad: bad.slice(0, 30),
            badCount: bad.length,
            cells,
            price: price
              ? {
                  w: price.clientWidth,
                  h: price.clientHeight,
                  font: getComputedStyle(price).fontSize,
                  line: getComputedStyle(price).lineHeight,
                  text: price.textContent,
                }
              : null,
          };
        });
        results.push({ slug, ...mode, ...row });
        if (!mode.preview && Math.abs(row.rootWidth - mode.width) > 2) {
          row.bad.push({ reason: "Public page does not fill device width" });
          row.badCount++;
        }
        if (process.argv.includes("--baseline") || row.badCount)
          console.log(JSON.stringify(results.at(-1)));
        if (
          slug === "draft" ||
          (slug.startsWith("clock:") && process.argv.includes("--baseline"))
        )
          await page
            .locator("[data-lp-canvas-root]")
            .screenshot({
              path:
                ".tmp/mobile-audit/" +
                (process.argv.includes("--baseline") ? "before" : "after") +
                "-" +
                slug.replace(":", "-") +
                "-" +
                mode.width +
                "-" +
                mode.preview +
                ".png",
              timeout: 30000,
            });
      }
      console.log("DONE mode " + JSON.stringify(mode));
    }
    const report = {
      templates: catalog.length,
      cases: results.length,
      errors,
      results,
    };
    fs.writeFileSync(
      ".tmp/mobile-audit/" +
        (process.argv.includes("--baseline") ? "baseline" : "results") +
        ".json",
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        templates: catalog.length,
        cases: results.length,
        failures: results.filter((r) => r.badCount).length,
        errors,
      }),
    );
    if (errors.length || results.some((r) => r.badCount)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
