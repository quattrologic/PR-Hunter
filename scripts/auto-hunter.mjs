// Unattended public Auto-Hunter report. No personal data and no entries submitted.
// Runs after the existing public RSS scout in the scheduled GitHub workflow.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { autoHunterReport } from '../docs/auto-hunter-core.mjs';

export async function buildPublicAutoReport(catalog, now = new Date()) {
  const ts = now instanceof Date ? now.getTime() : Number(now);
  if(!Number.isFinite(ts)) throw Error('Invalid clock');
  const items = Array.isArray(catalog?.opportunities) ? catalog.opportunities : [];
  const report = autoHunterReport(items,{},ts);
  return {
    version:1,
    scope:'public-website-discovery-only',
    generatedAt:new Date(ts).toISOString(),
    catalogGeneratedAt:catalog?.generatedAt || null,
    websiteScanAutomated:true,
    automaticSubmissionsEnabled:false,
    providerAdaptersActive:0,
    counts:report.counts,
    items:report.items
  };
}
async function run() {
  const catalogPath=new URL('../docs/opportunities.json',import.meta.url);
  const outputPath=new URL('../docs/auto-hunter.json',import.meta.url);
  const data=JSON.parse(await readFile(catalogPath,'utf8'));
  const result=await buildPublicAutoReport(data);
  await writeFile(outputPath,JSON.stringify(result,null,2)+'\n');
  console.log('Auto-Hunter:',result.counts.review,'review candidates,',
    result.counts.eligibleManual,'manual-ready, 0 submitted');
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1]))) {
  run().catch(error=>{console.error(error);process.exitCode=1;});
}
