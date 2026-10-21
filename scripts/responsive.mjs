// Horizontal overflow at five widths. Usage: node scripts/responsive.mjs <url> [guide|media]
//   (none)  the catalogue home; report only
//   guide   Dashboard overview, opened from the home page; report only
//   media   dashboard-overview with fixture media (scripts/lib/media-fixture.mjs) and the transcript
//           open; exits 1 when the panel's box leaves the viewport or the page scrolls sideways at
//           any width
import { chromium } from 'playwright';
import { installMediaFixture } from './lib/media-fixture.mjs';
const url=process.argv[2];
const mode=process.argv[3];
const WIDTHS=[375,768,1024,1440,1920];
const b=await chromium.launch();
const failures=[];
for(const w of WIDTHS){
  const page=await(await b.newContext({viewport:{width:w,height:900}})).newPage();
  if(mode==='media'){
    await installMediaFixture(page);
    await page.goto(url.replace(/#.*$/,'').replace(/\/?$/,'/')+'#/dashboard-overview',{waitUntil:'networkidle'});
    await page.waitForSelector('.lsa-media video',{timeout:10000}).catch(()=>{});
    await page.click('.lsa-media-transcript summary',{timeout:5000}).catch(()=>{});
    await page.waitForTimeout(800);
  } else {
    await page.goto(url,{waitUntil:'networkidle'}); await page.waitForTimeout(1000);
  }
  if(mode==='guide'){try{await page.getByText('Dashboard overview',{exact:false}).first().click({timeout:5000});await page.waitForTimeout(2000);}catch{}}
  const m=await page.evaluate(()=>{
    const p=document.querySelector('.lsa-media');
    const r=p&&p.getBoundingClientRect();
    return {
      scrollW:document.documentElement.scrollWidth,
      clientW:document.documentElement.clientWidth,
      overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      bodyText:(document.body.innerText||'').length,
      panel:r?{left:Math.round(r.left*10)/10,right:Math.round(r.right*10)/10,width:Math.round(r.width)}:null,
      transcriptOpen:!!document.querySelector('.lsa-media-transcript')?.open,
    };
  });
  await page.screenshot({path:`/tmp/resp-${mode||'home'}-${w}.png`});
  let line=`${String(w).padStart(4)}px  overflowX=${String(m.overflowX).padStart(5)}  scrollW=${m.scrollW}  text=${m.bodyText}`;
  if(mode==='media'){
    line+=m.panel?`  panel=${m.panel.left}..${m.panel.right} (${m.panel.width}px)`:'  panel=none';
    if(!m.panel) failures.push(`${w}px: no panel`);
    else if(m.panel.left<0||m.panel.right>m.clientW+0.5) failures.push(`${w}px: panel ${m.panel.left}..${m.panel.right} leaves the ${m.clientW}px viewport`);
    if(!m.transcriptOpen) failures.push(`${w}px: transcript did not open`);
    if(m.overflowX!==0) failures.push(`${w}px: overflowX=${m.overflowX}`);
  }
  console.log(line);
  await page.close();
}
await b.close();
if(mode==='media'){
  console.log(failures.length?`\nRESPONSIVE (media): FAIL\n- ${failures.join('\n- ')}`:'\nRESPONSIVE (media): PASS');
  process.exit(failures.length?1:0);
}
