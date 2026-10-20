// Verifies deep links and browser Back work — a guide site is shared by URL.
import { chromium } from 'playwright';
import { parseShowBeta, loadRelease } from '../src/release.mjs';
const url=process.argv[2];
// Release mode, read the way build.mjs reads it (SA_SHOW_BETA, and SA_RELEASE_FILE for tests).
const showBeta=parseShowBeta(process.env.SA_SHOW_BETA);
const {release}=loadRelease();
const betaKeys=Object.keys(release.guides).filter(k=>release.guides[k].status==='beta');
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
// Beta deep links. Hidden: each beta guide's #/<key> must fall back to the catalogue exactly like
// the unknown key above, because the build removed the guide. Shown: each must open the guide
// with its Beta banner.
const banner=()=>page.evaluate(()=>document.querySelector('.lsa .lsa-beta-banner')?.textContent?.replace(/\s+/g,' ').trim()||null);
r.beta={mode:showBeta?'shown':'hidden',links:{}};
for(const k of betaKeys){
  await page.goto(url.replace(/\/$/,'')+'/#/'+k,{waitUntil:'networkidle'});await page.waitForTimeout(1800);
  r.beta.links[k]={...(await st()),banner:await banner()};
}
const betaOk=betaKeys.every(k=>{
  const v=r.beta.links[k];
  if(!showBeta) return v.h1===r.badKey.h1 && v.hash===(r.badKey.hash==='#/no-such-guide'?'#/'+k:r.badKey.hash) && v.banner===null;
  return v.hash==='#/'+k && !!v.h1 && v.h1!==r.badKey.h1 && /^Beta\./.test(v.banner||'');
});
r.errors=[...new Set(errs)];
const pass = r.afterOpen.hash==='#/minimum-threshold'
  && r.afterBack.hash===''
  && r.afterForward.hash==='#/minimum-threshold'
  && /Push changes to Lynx/i.test(r.deepLink.h1||'')
  && /Spatial Adjust Guides/i.test(r.badKey.h1||'')
  && betaOk
  && errs.length===0;
console.log(JSON.stringify(r,null,2));
console.log(pass?'\nROUTING: PASS':'\nROUTING: FAIL');
await b.close();process.exit(pass?0:1);
