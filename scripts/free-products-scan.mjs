import { freeDropDiscovery } from '../docs/free-drops.mjs';
// Public Free-Product-Hunter snapshot. Inputs are GitHub's public catalog and
// previously reviewed first-party program links. No portal logins or submissions.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { OFFICIAL_PROGRAMS, classifyPublicLeads, programWarnings } from '../docs/free-products.mjs';

export function createFreeProductsSnapshot(catalog, now=new Date()) {
  const when=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(when.getTime()))throw Error('Invalid snapshot time');
  const items=Array.isArray(catalog?.opportunities)?catalog.opportunities:[];
  const leads=classifyPublicLeads(items,{},when.getTime());
  const drops=freeDropDiscovery(items,{},when.getTime());
  return {
    version:1,
    scope:'public-discovery-and-reviewed-program-directory',
    generatedAt:when.toISOString(),
    catalogGeneratedAt:catalog?.generatedAt||null,
    programDirectoryReviewNotLive:true,
    automatedApplications:false,
    programCount:OFFICIAL_PROGRAMS.length,
    freeDropHunter:{
      generatedFrom:'public-catalog',
      counts:drops.counts,
      items:drops.items.map(item=>({
        id:item.id,title:item.title,url:item.url,kind:item.kind,
        category:item.category,sourceReviewed:item.curated,
        germany:item.germany,shippingEUR:item.shippingEUR,
        priceEUR:item.priceEUR,deadline:item.deadline,
        warnings:item.warnings
      }))
    },
    programs:OFFICIAL_PROGRAMS.map(program=>({
      id:program.id,name:program.name,category:program.category,type:program.type,
      url:program.url,checkedOn:program.checkedOn,
      notes:programWarnings(program,when.getTime())
    })),
    opportunityCount:leads.length,
    opportunityTypes:{
      productTests:leads.filter(x=>x.leadKind==='product_test').length,
      collaborations:leads.filter(x=>x.leadKind==='creator').length,
      giveaways:leads.filter(x=>x.leadKind==='giveaway').length
    },
    opportunities:leads.map(x=>({
      id:x.id,title:x.title,url:x.url,category:x.category,
      leadKind:x.leadKind,sourceType:x.sourceType||'rss',
      deadline:x.deadline||null,reviewNeeded:true
    })),
    applied:0,received:0
  };
}
async function run(){
  const catalog=JSON.parse(await readFile(new URL('../docs/opportunities.json',import.meta.url),'utf8'));
  const report=createFreeProductsSnapshot(catalog);
  await writeFile(new URL('../docs/free-products-report.json',import.meta.url),
    JSON.stringify(report,null,2)+'\n');
  console.log('Free-Product-Hunter:',report.programCount,'reviewed program links,',
    report.opportunityCount,'public leads, 0 submitted applications');
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1]))){
  run().catch(error=>{console.error(error);process.exitCode=1;});
}
