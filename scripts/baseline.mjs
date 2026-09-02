import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch();
const page = await (await b.newContext()).newPage();
const external = [], errors = [], failed = [];
page.on('request', r => { const u = r.url(); if (!u.startsWith('http://localhost')) external.push(u); });
page.on('requestfailed', r => failed.push(r.url() + ' :: ' + r.failure()?.errorText));
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(2500);
const probe = await page.evaluate(() => {
  const root = document.querySelector('#dc-root');
  const txt = document.body.innerText || '';
  return {
    dcRootExists: !!root,
    xDcStillPresent: !!document.querySelector('x-dc'),
    renderedChars: root ? root.innerHTML.length : 0,
    bodyTextChars: txt.length,
    h1: [...document.querySelectorAll('h1,h2')].slice(0,3).map(e => e.innerText.trim()).filter(Boolean),
    mentionsSpatial: /spatial adjust/i.test(txt),
    cards: txt.match(/\bMIN\b/g)?.length || 0,
  };
});
console.log(JSON.stringify({ probe, externalRequests: [...new Set(external)], failed, errors: [...new Set(errors)] }, null, 2));
await b.close();
