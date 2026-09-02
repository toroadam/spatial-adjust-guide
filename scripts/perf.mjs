import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf'};
const srv=createServer(async(req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';const f=join(process.argv[2],normalize(p).replace(/^(\.\.[/\\])+/,''));const b=await readFile(f);const gz=/\.(html|js|css|svg|json)$/.test(f)&&/gzip/.test(req.headers['accept-encoding']||'');const body=gz?gzipSync(b):b;res.writeHead(200,{'Content-Type':MIME[extname(f)]||'application/octet-stream',...(gz?{'Content-Encoding':'gzip'}:{})});res.end(body)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>srv.listen(0,r)); const {port}=srv.address();
const b=await chromium.launch(); const page=await(await b.newContext()).newPage();
const cdp=await page.context().newCDPSession(page);
await cdp.send('Network.enable');
// Fast 3G: 1.6Mbps down, 750kbps up, 150ms RTT
await cdp.send('Network.emulateNetworkConditions',{offline:false,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8,latency:150});
await page.goto(`http://localhost:${port}${process.argv[3]||'/'}`,{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>document.querySelector('#dc-root')?.innerHTML.length>20000,{timeout:120000});
const m=await page.evaluate(()=>{const paints=performance.getEntriesByType('paint');const fcp=paints.find(p=>p.name==='first-contentful-paint')||paints[0];return{paints:paints.map(p=>p.name+':'+Math.round(p.startTime)),fcp:fcp?Math.round(fcp.startTime):null,domContentLoaded:Math.round(performance.timing.domContentLoadedEventEnd-performance.timing.navigationStart),transferKB:Math.round(performance.getEntriesByType('resource').reduce((s,r)=>s+(r.transferSize||0),0)/1024),requests:performance.getEntriesByType('resource').length}});
console.log(JSON.stringify(m));
await b.close(); srv.close();
