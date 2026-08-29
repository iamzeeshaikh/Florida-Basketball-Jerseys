import { chromium } from 'playwright';
const [url, width] = [process.argv[2], Number(process.argv[3] || 390)];
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width, height: 900 } })).newPage();
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);
console.log(JSON.stringify(await page.evaluate(() => {
  const de = document.documentElement;
  const w = () => de.scrollWidth - de.clientWidth;
  const start = w();
  const hits = [];
  const walk = (el, d) => {
    if (d > 16) return;
    for (const c of [...el.children]) {
      if (c.tagName === 'SCRIPT' || c.tagName === 'STYLE') continue;
      const prev = c.style.display;
      c.style.display = 'none';
      const after = w();
      c.style.display = prev;
      if (after < start - 1) {
        const n = hits.length;
        walk(c, d + 1);
        if (hits.length === n) {
          const r = c.getBoundingClientRect();
          hits.push({ tag: c.tagName, cls: (c.className||'').toString().trim().split(/\s+/).slice(0,3).join('.'),
            drop: start - after, w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right),
            txt: (c.textContent||'').trim().slice(0,34) });
        }
      }
    }
  };
  walk(document.body, 0);
  return { start, hits: hits.slice(0, 5) };
}), null, 1));
await b.close();
