const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LP_HEADER_BASE || 'http://127.0.0.1:13048';
const artifacts = process.env.LP_HEADER_ARTIFACTS || '/var/www/aibeego_com_usr/header-navigation-fix-20261118';
const routes = [
  '/p/agency-portfolio-cream-editorial-sales-6',
  '/p/agency-portfolio-dark-direct-response-10',
  '/lp-template-shot/agency-portfolio',
  '/lp-template-shot/spa-wellness-clinic-clean',
];
(async () => {
  const browser = await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  let checks = 0;
  try {
    for (const route of routes) {
      for (const width of [1440, 768, 375]) {
        const page = await browser.newPage({viewport:{width,height:900}});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
          const original = Element.prototype.scrollIntoView;
          Element.prototype.scrollIntoView = function(options) {
            window.__headerScrollTarget = this.dataset.lpBlockId || this.id;
            return original.call(this,options);
          };
        });
        const response = await page.goto(base + route,{waitUntil:'domcontentloaded',timeout:60000});
        assert(response.ok(),route+': HTTP '+response.status());
        const header = page.locator('header').first();
        await header.waitFor();
        await header.locator('.lp-header-navigation, .desktop-nav').first().waitFor({state:'attached',timeout:15000});
        const generic = await header.locator('.lp-header-navigation').count() > 0;
        if (generic) await page.waitForFunction(() => document.querySelector('header') && getComputedStyle(document.querySelector('header')).containerName === 'lp-header', null, {timeout:15000});
        const desktop = header.locator('.lp-header-desktop-links, .desktop-nav');
        const toggle = header.locator('.lp-header-menu-toggle, .menu-toggle');
        if (width === 1440) {
          assert(await desktop.isVisible(),route+': desktop menu visible');
          assert(await desktop.locator('a').count() > 0,route+': desktop links');
          assert(!await toggle.isVisible(),route+': toggle hidden on desktop');
        } else {
          assert(!await desktop.isVisible(),route+': desktop menu collapsed');
          await toggle.waitFor({state:'visible',timeout:15000});
          assert(await toggle.isVisible(),route+': mobile toggle visible');
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-expanded'),'true');
          const mobile = header.locator('.lp-header-mobile-links, .mobile-nav');
          assert(await mobile.isVisible());
          await toggle.press('Escape');
          assert.equal(await toggle.getAttribute('aria-expanded'),'false');
          await toggle.click();
        }
        const nav = width === 1440 ? desktop : header.locator('.lp-header-mobile-links, .mobile-nav');
        const links = nav.locator('a[href^="#"]');
        const count = await links.count();
        assert(count > 0,route+': navigation has targets');
        for (let index=0; index<count; index++) {
          const href = await links.nth(index).getAttribute('href');
          // The agency mobile contact CTA has its existing lead-form alias.
          if (href==='#lead-form') continue;
          assert(await page.evaluate(id => Array.from(document.querySelectorAll('[data-lp-block-id], [id]')).some(el=>el.dataset.lpBlockId===id || el.id===id),href.slice(1)),route+': target '+href);
        }
        const chosen = links.first();
        const href = await chosen.getAttribute('href');
        await chosen.click();
        assert.equal(await page.evaluate(()=>window.__headerScrollTarget),href.slice(1),route+': link scrolls to correct block');
        if (width!==1440) assert.equal(await toggle.getAttribute('aria-expanded'),'false',route+': closes after navigation');
        await page.evaluate(()=>window.scrollTo(0,0));
        if (route===routes[0]) {
          if (width!==1440) await toggle.click();
          await page.screenshot({path:artifacts+'/after-'+width+'.png'});
        }
        assert.deepEqual(errors,[],route+': no browser exceptions');
        console.log('PASS',route,width,'px;',count,'links');
        checks++;
        await page.close();
      }
    }
    console.log('PASS browser header navigation:',checks,'responsive cases');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
