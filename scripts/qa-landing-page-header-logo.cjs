const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const root=process.env.LP_LOGO_QA_DIR || '/var/www/aibeego_com_usr/logo-header-fix-20261118';
const templates=JSON.parse(fs.readFileSync(root+'/templates.json','utf8'));
const svg=(w,h)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#14b8a6"/></svg>`);
(async()=>{
 const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.setContent('<html><head><base href="https://aibeego.com/"></head><body><div id="app"></div></body></html>');
  await page.addStyleTag({path:root+'/production.css'});
  await page.addStyleTag({path:root+'/fixed/motion.css'});
  await page.addScriptTag({path:root+'/fixed/motion.js'});
  await page.evaluate(()=>{
   window.logoRoot=createRoot(document.getElementById('app'));
   window.logoCanvas={selection:null,selectedElementIds:[],primarySelectedId:null,isSelected:()=>false,isPrimarySelected:()=>false,isSectionPrimary:()=>false,onSelect(){},onDeselect(){},onFieldLive(){},onFieldCommit(){},onDuplicate(){},onDelete(){},onMove(){},onReorderBlock(){},onReorderItem(){},onAi(){},onReplaceImage(){}};
   window.mountLogo=async(spec,mode,viewport)=>{
    logoRoot.render(React.createElement(LandingPageRenderer,{spec,mode:mode==='editor'?'preview':mode,viewport,interactive:mode==='editor',canvas:mode==='editor'?logoCanvas:null}));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   };
   window.measureLogo=()=>{
    const img=document.querySelector('header .lp-header-logo [data-lp-content-image]');
    if(!img)return {error:'missing logo'};
    const a=img.getBoundingClientRect(),b=img.closest('header').getBoundingClientRect();
    return {width:a.width,height:a.height,top:a.top,bottom:a.bottom,headerTop:b.top,headerBottom:b.bottom,fit:getComputedStyle(img).objectFit,fallback:img.hasAttribute('data-lp-img-fallback')};
   };
  });
  const valid=(m,label)=>{
   assert(!m.error,label+': '+m.error);
   assert(m.height>0&&m.height<=48.5,label+': height '+m.height);
   assert(m.width>0&&m.width<=160.5,label+': width '+m.width);
   assert(m.top>=m.headerTop-1&&m.bottom<=m.headerBottom+1,label+': contained in header');
   assert.equal(m.fit,'contain',label+': aspect ratio preserved');
  };
  const course=templates.find(t=>t.slug==='online-course');
  let detailed=0;
  for(const [width,viewport] of [[1500,'desktop'],[768,'tablet'],[375,'mobile']]){
   await page.setViewportSize({width,height:900});
   for(const mode of ['public','preview','editor']){
    await page.evaluate(({spec,mode,viewport})=>mountLogo(spec,mode,viewport),{spec:course.spec,mode,viewport});
    await page.waitForFunction(()=>{const img=document.querySelector('header .lp-header-logo img');return img?.complete&&img.naturalWidth>0});
    const m=await page.evaluate(()=>measureLogo());valid(m,`course ${mode} ${width}`);
    if(mode==='preview')await page.screenshot({path:root+'/fixed-'+width+'.png'});
    console.log('PASS original course template',mode,width,JSON.stringify(m));detailed++;
   }
  }
  let catalog=0;
  for(const [width,viewport] of [[1500,'desktop'],[375,'mobile']]){
   await page.setViewportSize({width,height:900});
   const results=await page.evaluate(async({templates,src,viewport})=>{
    const rows=[];
    for(const t of templates){
     const spec=structuredClone(t.spec);
     const header=spec.blocks.find(b=>b.type==='Header'&&b.enabled);if(!header)continue;
     header.imageUrl=src;spec.blocks=[header];
     await mountLogo(spec,'public',viewport);
     rows.push({slug:t.slug,...measureLogo()});
    }
    return rows;
   },{templates,src:svg(2048,2048),viewport});
   for(const m of results)valid(m,m.slug+' '+width);catalog+=results.length;
   console.log('PASS catalog',results.length,'templates at',width,'px');
  }
  const synthetic=[];
  for(const [name,url] of [['square',svg(2048,2048)],['wide',svg(4000,500)],['tall',svg(500,4000)],['failed','data:image/png;base64,not-an-image']]){
   const spec=structuredClone(course.spec);const header=spec.blocks.find(b=>b.type==='Header');header.imageUrl=url;spec.blocks=[header];
   if(name==='tall')header.style.elementCustomCss.image='height: auto; min-height: 300px; width: 900px;';
   await page.evaluate(({spec})=>mountLogo(spec,'public','mobile'),{spec});
   await page.waitForFunction(()=>{const el=document.querySelector('header .lp-header-logo [data-lp-content-image]');return el&&(el.hasAttribute('data-lp-img-fallback')||el.complete)});
   const m=await page.evaluate(()=>measureLogo());valid(m,name);synthetic.push({name,...m});
  }
  assert.deepEqual(errors,[],'No renderer exceptions');
  fs.writeFileSync(root+'/logo-qa-results.json',JSON.stringify({detailed,catalog,synthetic},null,2));
  console.log(`PASS logo QA: ${detailed} public/preview/editor cases, ${catalog} catalog renders, square/wide/tall/failed images`);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
