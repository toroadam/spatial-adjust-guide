import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
const b=await chromium.launch();
const page=await(await b.newContext({viewport:{width:1440,height:900}})).newPage();
await page.goto(process.argv[2],{waitUntil:'networkidle'}); await page.waitForTimeout(1200);
if(process.argv[3]==='guide'){await page.getByText('Dashboard overview',{exact:false}).first().click();await page.waitForTimeout(2500);}
const r=await new AxeBuilder({page}).withTags(['wcag2aa']).analyze();
const cc=r.violations.find(v=>v.id==='color-contrast');
if(!cc){console.log('no contrast violations');process.exit(0)}
const inApp=[],inChrome=[];
for(const n of cc.nodes){
  const sel=n.target.join(' ');
  const isApp=await page.evaluate(s=>{try{const e=document.querySelector(s);return !!(e&&e.closest('.sa-app'))}catch{return false}},sel);
  const rec={sel:sel.slice(0,70),msg:(n.any[0]?.message||'').slice(0,90)};
  (isApp?inApp:inChrome).push(rec);
}
console.log(`total=${cc.nodes.length}  inAppMock=${inApp.length}  inGuideChrome=${inChrome.length}`);
console.log('\n--- guide chrome (ours to fix) ---');
for(const x of inChrome.slice(0,12)) console.log('  ',x.sel,'\n     ',x.msg);
await b.close();
