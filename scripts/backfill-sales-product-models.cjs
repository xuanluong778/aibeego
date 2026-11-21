// Explicit model labels only. Defaults to dry-run; run inside the intended API container with --apply.
if (!process.env.DATABASE_URL) throw Error('Set DATABASE_URL explicitly; this script does not load .env');
let PrismaClient, sourceProductModel;
try { ({PrismaClient}=require('@marketingspa/database')); ({sourceProductModel}=require('@marketingspa/shared/dist/sales-product-source')); }
catch { ({PrismaClient}=require('../packages/database/dist')); ({sourceProductModel}=require('../packages/shared/dist/sales-product-source')); }
const db=new PrismaClient();
(async()=>{
 const sources=await db.wooCommerceProduct.findMany({where:{product:{model:null}},select:{organizationId:true,productId:true,snapshot:true}});
 const grouped=new Map();
 for(const source of sources){
  const model=sourceProductModel(source.snapshot);if(!model)continue;
  const key=source.organizationId+':'+source.productId;
  const group=grouped.get(key)||{organizationId:source.organizationId,productId:source.productId,models:new Set()};group.models.add(model);grouped.set(key,group);
 }
 const plans=[...grouped.values()].filter(group=>group.models.size===1),apply=process.argv.includes('--apply');
 let updated=0;const orgs=new Set();
 if(apply) for(const plan of plans){
  const model=[...plan.models][0];
  await db.$transaction(async tx=>{
   const result=await tx.salesProduct.updateMany({where:{id:plan.productId,organizationId:plan.organizationId,model:null},data:{model}});
   if(result.count){await tx.auditLog.create({data:{organizationId:plan.organizationId,action:'SALES_PRODUCT_MODEL_BACKFILL',entityType:'SALES_PRODUCT',entityId:plan.productId,metadata:{before:null,after:model,source:'explicit_website_model_label',schemaMigration:'20261121170000_sales_product_model'}}});updated+=result.count;orgs.add(plan.organizationId);}
  });
 }
 if(apply&&updated&&process.env.REDIS_URL){
  let redis;
  try {const Redis=require('ioredis');redis=new Redis(process.env.REDIS_URL,{lazyConnect:true,connectTimeout:3000,maxRetriesPerRequest:1,enableOfflineQueue:false});redis.on('error',()=>{});await redis.connect();for(const org of orgs)await redis.incr(`maaz:kpi:${org}:g`);await redis.quit();}
  catch {redis?.disconnect();console.warn('Model data committed; list cache will expire normally.');}
 }
 console.log(JSON.stringify({dryRun:!apply,explicitModelCandidates:plans.length,ambiguousSkipped:[...grouped.values()].filter(p=>p.models.size!==1).length,updated,stockOrPriceWrites:false}));
})().finally(()=>db.$disconnect()).catch(error=>{console.error(error.name);process.exitCode=1});
