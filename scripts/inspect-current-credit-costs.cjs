const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const dir=path.resolve(__dirname,'../tmp/credit-costs-review-20261122');fs.mkdirSync(dir,{recursive:true});
const code=`const {prisma}=require('@marketingspa/database');
(async()=>{
 const pricing=await prisma.creditFeaturePricing.findMany({orderBy:{sortOrder:'asc'}});
 const changes=await prisma.auditLog.findMany({where:{action:'PLATFORM_CREDIT_COST_UPDATED'},select:{metadata:true,createdAt:true},orderBy:{createdAt:'desc'},take:40});
 const recent=await prisma.creditTransaction.findMany({where:{type:'USAGE'},select:{featureCode:true,amount:true,metadata:true,createdAt:true},orderBy:{createdAt:'desc'},take:40});
 console.log(JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',transcribeModel:process.env.OPENAI_TRANSCRIBE_MODEL||'gpt-4o-mini-transcribe',pricing,
 changes:changes.map(r=>({createdAt:r.createdAt,featureCode:r.metadata?.featureCode,before:r.metadata?.before,after:r.metadata?.after})),
 usage:recent.map(r=>({featureCode:r.featureCode,amount:Number(r.amount),createdAt:r.createdAt,model:r.metadata?.model,units:r.metadata?.units,meteringAddon:r.metadata?.meteringAddon,billableSeconds:r.metadata?.billableSeconds}))}));
})().finally(()=>prisma.$disconnect());`;
const result=JSON.parse(execFileSync('docker',['exec','-i','marketingspa-api','node'],{input:code,encoding:'utf8',stdio:['pipe','pipe','pipe']}));
fs.writeFileSync(path.join(dir,'current.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
