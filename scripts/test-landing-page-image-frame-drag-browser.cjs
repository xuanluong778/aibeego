const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const qaModules = process.env.LP_QA_NODE_MODULES;
const wr = createRequire(
  qaModules
    ? path.join(path.resolve(qaModules), '../package.json')
    : path.join(root, 'apps/web/package.json'),
);
const pnpm = path.join(root, 'node_modules/.pnpm');
const esbuild = qaModules
  ? wr('esbuild')
  : createRequire(
      path.join(
        pnpm,
        fs.readdirSync(pnpm).find((n) => n.startsWith('esbuild@')),
        'node_modules/esbuild/package.json',
      ),
    )('./lib/main.js');
const out = process.env.LP_QA_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'lp-image-frame-'));
fs.mkdirSync(out, { recursive: true });

(async () => {
  const entry = `
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ElementChrome} from '${root.replaceAll('\\', '/')}/apps/web/src/components/landing-pages/landing-page-canvas-ux';
import {FreeGuidesProvider} from '${root.replaceAll('\\', '/')}/apps/web/src/components/landing-pages/landing-page-free-drag';
import {LandingPageElementVerticalToolbar} from '${root.replaceAll('\\', '/')}/apps/web/src/components/landing-pages/landing-page-element-vertical-toolbar';
import {AgencyPortfolioBlock} from '${root.replaceAll('\\', '/')}/apps/web/src/components/landing-pages/landing-page-agency-portfolio-blocks';
import {getLandingPageSystemTemplate} from '@marketingspa/shared';
const params=new URLSearchParams(location.search),zoom=Number(params.get('zoom'))||1,agency=params.has('agency');
const spec=getLandingPageSystemTemplate('agency-portfolio').spec;
const hero={...spec.blocks.find(b=>b.type==='Hero'),id:'hero',imageUrl:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='450'%3E%3Cpath fill='orange' d='M0 0h600v450H0z'/%3E%3C/svg%3E"};
function App(){
 const [layout,setLayout]=useState(()=>JSON.parse(localStorage.getItem('layout')||'null')||(params.has('saved')?{x:0,y:30,width:310,height:240}:null));
 const [tick,setTick]=useState(0),rootRef=useRef(null),history=useRef([]),future=useRef([]);
 const target={blockId:'hero',element:'image'};
 const handlers={viewport:'desktop',selection:target,isSelected:t=>t.element==='image',isPrimarySelected:t=>t.element==='image',onSelect:()=>{},getElementFreeLayout:(_id,field)=>field==='__element:image'?layout:null,onElementFreeLayoutCommit:(_id,_field,payload)=>{history.current.push(layout);future.current=[];setLayout(payload.freeLayout)}};
 const image=<ElementChrome blockId="hero" element="image" kind="image" handlers={handlers}><img draggable={false} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='270' height='350'%3E%3Cpath fill='orange' d='M0 0h270v350H0z'/%3E%3C/svg%3E" style={{width:'100%',height:'100%'}}/></ElementChrome>;
 window.editor={layout,commits:history.current.length,spec};
 return <><button id="rerender" onClick={()=>setTick(tick+1)}>Render {tick}</button><button id="undo" onClick={()=>{future.current.push(layout);setLayout(history.current.pop())}}>Undo</button><button id="redo" onClick={()=>{history.current.push(layout);setLayout(future.current.pop())}}>Redo</button><button id="save" onClick={()=>localStorage.setItem('layout',JSON.stringify(layout))}>Save</button>
 <div data-lp-renderer={agency?'agency-portfolio-v2':undefined} style={{transform:'scale('+zoom+')',transformOrigin:'top left',width:1100}}><FreeGuidesProvider><article ref={rootRef} data-lp-canvas-root style={{width:1100,height:800,position:'relative'}}><section data-lp-section-chrome="1" data-lp-block-id="hero" style={{width:1100,minHeight:800,padding:agency?0:'60px',boxSizing:'border-box'}}>{agency?<AgencyPortfolioBlock block={hero} spec={spec} canvas={handlers} renderForm={null}/>:<div id="frame" {...(params.has('marked')?{'data-lp-image-frame':'1'}:{})} style={{width:498,height:372,background:'#26313d',borderRadius:18,overflow:'hidden',border:'1px solid gray'}}><div style={{width:270,height:350}}>{image}</div></div>}</section></article></FreeGuidesProvider></div>
 <LandingPageElementVerticalToolbar enabled canvasRootRef={rootRef} primaryTarget={target} onSelect={()=>{}} onSave={()=>{}} onDuplicate={()=>{}} onDelete={()=>{}}/></>;
} createRoot(document.getElementById('root')).render(<App/>);`;
  const bundle = await esbuild.build({
    stdin: { contents: entry, resolveDir: path.join(root, 'apps/web'), loader: 'tsx' },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    tsconfigRaw: { compilerOptions: { target: 'ES2020', jsx: 'react-jsx' } },
    nodePaths: qaModules ? [path.resolve(qaModules)] : [],
    plugins: [
      {
        name: 'unused-server',
        setup(b) {
          b.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
          b.onResolve({ filter: /^(crypto|node:.*|@aws-sdk\/.*)$/ }, (a) => ({
            path: a.path,
            namespace: 'unused',
          }));
          b.onLoad({ filter: /.*/, namespace: 'unused' }, () => ({
            contents: 'module.exports={}',
            loader: 'js',
          }));
          if (qaModules)
            b.onResolve({ filter: /^[^./]/ }, (a) => {
              if (a.path.startsWith('@marketingspa/') || a.path.startsWith('@/')) return;
              try {
                return { path: wr.resolve(a.path) };
              } catch {
                if (a.path === 'zod') {
                  const dir = fs.readdirSync(pnpm).find((n) => n.startsWith('zod@'));
                  return { path: require.resolve(path.join(pnpm, dir, 'node_modules/zod')) };
                }
              }
            });
        },
      },
    ],
    alias: {
      '@marketingspa/shared': path.join(root, 'packages/shared/src/index.ts'),
      '@': path.join(root, 'apps/web/src'),
      react: path.dirname(wr.resolve('react/package.json')),
      'react-dom': path.dirname(wr.resolve('react-dom/package.json')),
    },
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  fs.writeFileSync(path.join(out, 'component.js'), bundle.outputFiles[0].contents);
  fs.writeFileSync(
    path.join(out, 'component.html'),
    `<style>body{margin:0}.relative{position:relative}.absolute{position:absolute}.fixed{position:fixed}.inset-0{inset:0}.pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}.hidden{display:none}[data-lp-element-vertical-toolbar]{width:44px;display:flex;flex-direction:column}[data-lp-vertical-tool]{width:44px;height:44px;padding:0}[data-lp-vertical-tool] svg{width:20px;height:20px}</style><div id="root"></div><script src="component.js"></script>`,
  );
  fs.appendFileSync(
    path.join(out, 'component.html'),
    '<style>' +
      fs.readFileSync(
        path.join(root, 'apps/web/src/components/landing-pages/landing-page-agency-portfolio.css'),
        'utf8',
      ) +
      '</style>',
  );
  const browser = await (qaModules ? wr('playwright') : require('playwright')).chromium.launch({
    ...(process.env.LP_QA_BROWSER ? { executablePath: process.env.LP_QA_BROWSER } : {}),
    headless: true,
  });
  try {
    const cases = [
      { marked: true },
      { marked: false },
      ...['toolbar', 'body'].flatMap((control) =>
        [false, true].map((saved) => ({ agency: true, control, saved })),
      ),
    ];
    for (const scenario of cases)
      for (const zoom of [1, 0.75]) {
        const { marked, agency, control, saved } = scenario;
        const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(
          require('node:url').pathToFileURL(path.join(out, 'component.html')).href +
            '?zoom=' +
            zoom +
            (marked ? '&marked' : '') +
            (agency ? '&agency' : '') +
            (saved ? '&saved' : ''),
        );
        await page.waitForFunction(() => window.editor);
        fs.writeFileSync(
          path.join(out, 'spec.json'),
          JSON.stringify(await page.evaluate(() => window.editor.spec)),
        );
        const frame = page.locator(agency ? '.photo-frame' : '#frame'),
          image = page.locator('[data-lp-element-kind="image"]');
        if (agency) {
          // Leave visible gray space like the reported frame with a smaller image.
          await page.addStyleTag({
            content: '.photo-frame img{width:60%!important;height:60%!important;margin-top:60px}',
          });
          assert(
            await frame.evaluate((el) => Boolean(el.closest('[data-lp-free-id]'))),
            'gray frame must be inside the draggable shell',
          );
        }
        const before = await frame.boundingBox(),
          imageBefore = await image.boundingBox();
        await page.locator('[data-lp-vertical-tool="move"]').hover();
        const handle = await page.locator('[data-lp-vertical-tool="move"]').boundingBox();
        const start =
          control === 'body'
            ? { x: before.x + before.width - 20 * zoom, y: before.y + before.height - 20 * zoom }
            : { x: handle.x + 22, y: handle.y + 22 };
        const dx = agency ? -100 : 100;
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + dx * zoom, start.y + 80 * zoom, { steps: 15 });
        await page.waitForTimeout(80);
        const during = await frame.boundingBox(),
          imageDuring = await image.boundingBox();
        assert(
          Math.abs(during.x - before.x - dx * zoom) < 3,
          'frame must move horizontally ' + JSON.stringify({ scenario, zoom, before, during }),
        );
        // Guides may snap to neighboring text within the engine's 10 CSS px range.
        assert(
          Math.abs(during.y - before.y - 80 * zoom) < 10 * zoom + 1,
          'frame must move vertically ' + JSON.stringify({ scenario, zoom, before, during }),
        );
        assert(
          Math.abs(imageDuring.x - imageBefore.x - (during.x - before.x)) < 2,
          'image must follow frame',
        );
        // Force a React render while the pointer remains down.
        await page.evaluate(() => document.querySelector('#rerender').click());
        await page.waitForTimeout(40);
        assert(
          Math.abs((await image.boundingBox()).x - imageDuring.x) < 2,
          'rerender must not double image translation',
        );
        await page.mouse.up();
        await page.waitForTimeout(60);
        const after = await frame.boundingBox();
        assert(
          Math.abs(after.x - during.x) < 2,
          'drop position ' +
            JSON.stringify({
              scenario,
              zoom,
              during,
              after,
              debug: await page.evaluate(() => ({
                layout: window.editor.layout,
                paint: [...document.querySelectorAll('[data-lp-free-paint-host]')].map((el) => [
                  el.tagName,
                  el.className,
                  el.style.cssText,
                ]),
                image: document.querySelector('[data-lp-element-kind="image"]').style.cssText,
              })),
            }),
        );
        assert(Math.abs(after.width - during.width) < 2, 'drop width');
        assert(
          Math.abs(after.y - during.y) < 2,
          'drop vertical position ' + JSON.stringify({ scenario, zoom, during, after }),
        );
        assert.equal(await page.evaluate(() => window.editor.commits), 1);
        await page.locator('#undo').click();
        assert(Math.abs((await frame.boundingBox()).x - before.x) < 2, 'undo frame');
        assert(
          Math.abs((await frame.boundingBox()).y - before.y) < 2,
          'undo frame vertical position',
        );
        await page.locator('#redo').click();
        assert(Math.abs((await frame.boundingBox()).x - after.x) < 2, 'redo frame');
        await page.locator('#save').click();
        await page.reload();
        await page.waitForFunction(() => window.editor);
        assert(Math.abs((await frame.boundingBox()).x - after.x) < 2, 'reload frame');
        assert(
          Math.abs((await frame.boundingBox()).y - after.y) < 2,
          'reload frame vertical position',
        );
        await page.locator('[data-lp-vertical-tool="move"]').hover();
        const cancelHandle = await page.locator('[data-lp-vertical-tool="move"]').boundingBox();
        await page.mouse.move(cancelHandle.x + 22, cancelHandle.y + 22);
        await page.mouse.down();
        await page.mouse.move(cancelHandle.x + 22 + 40 * zoom, cancelHandle.y + 22 + 30 * zoom, {
          steps: 8,
        });
        await page.waitForTimeout(50);
        await page.evaluate(() =>
          window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })),
        );
        await page.mouse.up();
        await page.waitForTimeout(50);
        assert(Math.abs((await frame.boundingBox()).x - after.x) < 2, 'cancel restores frame');
        assert.equal(await page.evaluate(() => window.editor.commits), 0, 'cancel must not commit');
        assert.deepEqual(errors, []);
        await page.close();
        console.log('PASS', JSON.stringify({ scenario, zoom }));
      }
    console.log(
      'PASS image and frame move together at 100%/75% zoom; rerender, drop, undo/redo, reload and pointer cancel',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
