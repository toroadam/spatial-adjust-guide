// Verifies deep links and browser Back work — a guide site is shared by URL.
import { chromium } from 'playwright';
const url=process.argv[2];
const b=await chromium.launch();const page=await(await b.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[];page.on('pageerror',e=>errs.push(String(e).slice(0,120)));
const st=()=>page.evaluate(()=>({hash:location.hash,h1:document.querySelector('.lsa h1')?.textContent?.trim().slice(0,40)}));
const r={};
await page.goto(url,{waitUntil:'networkidle'});await page.waitForTimeout(1400);
r.start=await st();
await page.getByText('Set a minimum threshold',{exact:false}).first().click();await page.waitForTimeout(1800);
r.afterOpen=await st();
await page.goBack();await page.waitForTimeout(1500);
r.afterBack=await st();
await page.goForward();await page.waitForTimeout(1500);
r.afterForward=await st();
// deep link: load the URL directly
await page.goto(url.replace(/\/$/,'')+'/#/push-to-lynx',{waitUntil:'networkidle'});await page.waitForTimeout(2200);
r.deepLink=await st();
// unknown key must fall back to the catalog, not a blank page
await page.goto(url.replace(/\/$/,'')+'/#/no-such-guide',{waitUntil:'networkidle'});await page.waitForTimeout(1800);
r.badKey=await st();
r.errors=[...new Set(errs)];
const pass = r.afterOpen.hash==='#/minimum-threshold'
  && r.afterBack.hash===''
  && r.afterForward.hash==='#/minimum-threshold'
  && /Push changes to Lynx/i.test(r.deepLink.h1||'')
  && /Spatial Adjust Guides/i.test(r.badKey.h1||'')
  && errs.length===0;
console.log(JSON.stringify(r,null,2));
console.log(pass?'\nROUTING: PASS':'\nROUTING: FAIL');
await b.close();process.exit(pass?0:1);
