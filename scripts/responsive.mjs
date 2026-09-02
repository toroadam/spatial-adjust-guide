import { chromium } from 'playwright';
const url=process.argv[2];
const WIDTHS=[375,768,1024,1440,1920];
const b=await chromium.launch();
for(const w of WIDTHS){
  const page=await(await b.newContext({viewport:{width:w,height:900}})).newPage();
  await page.goto(url,{waitUntil:'networkidle'}); await page.waitForTimeout(1000);
  if(process.argv[3]==='guide'){try{await page.getByText('Dashboard overview',{exact:false}).first().click({timeout:5000});await page.waitForTimeout(2000);}catch{}}
  const m=await page.evaluate(()=>({
    scrollW:document.documentElement.scrollWidth,
    clientW:document.documentElement.clientWidth,
    overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    bodyText:(document.body.innerText||'').length,
  }));
  await page.screenshot({path:`/tmp/resp-${process.argv[3]||'home'}-${w}.png`});
  console.log(`${String(w).padStart(4)}px  overflowX=${String(m.overflowX).padStart(5)}  scrollW=${m.scrollW}  text=${m.bodyText}`);
  await page.close();
}
await b.close();
