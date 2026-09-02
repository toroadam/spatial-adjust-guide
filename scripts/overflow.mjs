import { chromium } from 'playwright';
const b=await chromium.launch();
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
