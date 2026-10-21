// Which elements stick out past the viewport. Usage: node scripts/overflow.mjs <url> [guide|media]
//   (none)  the catalogue home at 375px; report only
//   guide   Dashboard overview at 375px, opened from the home page; report only
//   media   dashboard-overview with fixture media (scripts/lib/media-fixture.mjs) and the transcript
//           open, at 375, 768, 1024, 1440 and 1920px; exits 1 when the panel's box, or anything in
//           it, leaves the viewport, or the page scrolls sideways, at any width
import { chromium } from 'playwright';
import { installMediaFixture } from './lib/media-fixture.mjs';
const b=await chromium.launch();
if(process.argv[3]==='media'){
  const base=process.argv[2].replace(/#.*$/,'').replace(/\/?$/,'/');
  const failures=[], report={};
  for(const w of [375,768,1024,1440,1920]){
    const page=await(await b.newContext({viewport:{width:w,height:900}})).newPage();
    await installMediaFixture(page);
    await page.goto(base+'#/dashboard-overview',{waitUntil:'networkidle'});
    await page.waitForSelector('.lsa-media video',{timeout:10000}).catch(()=>{});
    await page.click('.lsa-media-transcript summary',{timeout:5000}).catch(()=>{});
    await page.waitForTimeout(800);
    const out=await page.evaluate(()=>{
      const vw=document.documentElement.clientWidth;
      const p=document.querySelector('.lsa-media');
      const r=p&&p.getBoundingClientRect();
      const inPanel=p?[...p.querySelectorAll('*')].filter((e)=>{const x=e.getBoundingClientRect();return x.left<-1||x.right>vw+1;})
        .map((e)=>({tag:e.tagName.toLowerCase(),cls:(e.className||'').toString().slice(0,30),left:Math.round(e.getBoundingClientRect().left),right:Math.round(e.getBoundingClientRect().right)})):[];
      return {vw,overflowX:document.documentElement.scrollWidth-vw,
        panel:r?{left:Math.round(r.left*10)/10,right:Math.round(r.right*10)/10}:null,
        transcriptOpen:!!document.querySelector('.lsa-media-transcript')?.open,
        inPanel};
    });
    report[w]=out;
    if(!out.panel) failures.push(`${w}px: no panel`);
    else if(out.panel.left<0||out.panel.right>out.vw+0.5) failures.push(`${w}px: panel ${out.panel.left}..${out.panel.right} leaves the ${out.vw}px viewport`);
    if(out.inPanel.length) failures.push(`${w}px: ${out.inPanel.length} element(s) in the panel leave the viewport`);
    if(!out.transcriptOpen) failures.push(`${w}px: transcript did not open`);
    if(out.overflowX!==0) failures.push(`${w}px: overflowX=${out.overflowX}`);
    await page.close();
  }
  console.log(JSON.stringify(report,null,2)); await b.close();
  console.log(failures.length?`\nOVERFLOW (media): FAIL\n- ${failures.join('\n- ')}`:'\nOVERFLOW (media): PASS');
  process.exit(failures.length?1:0);
}
const page=await(await b.newContext({viewport:{width:375,height:900}})).newPage();
await page.goto(process.argv[2],{waitUntil:'networkidle'}); await page.waitForTimeout(1200);
if(process.argv[3]==='guide'){await page.getByText('Dashboard overview',{exact:false}).first().click();await page.waitForTimeout(2000);}
const out=await page.evaluate(()=>{
  const vw=document.documentElement.clientWidth, res=[];
  for(const e of document.querySelectorAll('*')){
    const r=e.getBoundingClientRect();
    if(r.width>vw+1||r.right>vw+1){
      const s=getComputedStyle(e);
      res.push({tag:e.tagName.toLowerCase(),cls:(e.className||'').toString().slice(0,30),
        w:Math.round(r.width),right:Math.round(r.right),
        cssW:s.width,minW:s.minWidth,
        text:(e.textContent||'').trim().slice(0,40)});
    }
  }
  return {vw,count:res.length,top:res.slice(0,14)};
});
console.log(JSON.stringify(out,null,2)); await b.close();
