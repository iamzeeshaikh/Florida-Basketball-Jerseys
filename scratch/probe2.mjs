import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: Number(process.argv[4] || 390), height: 900 } })).newPage();
await p.goto(process.argv[2], { waitUntil: 'domcontentloaded' });
await p.evaluate(() => document.fonts.ready);
console.log(JSON.stringify(await p.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return 'not found';
  const out = [];
  let n = el;
  for (let i = 0; i < 10 && n && n !== document.documentElement; i++, n = n.parentElement) {
    const cs = getComputedStyle(n), r = n.getBoundingClientRect();
    out.push({ tag: n.tagName, cls: (n.className||'').toString().trim().split(/\s+/).slice(0,2).join('.'),
      w: Math.round(r.width), left: Math.round(r.left), display: cs.display,
      ovx: cs.overflowX, minW: cs.minWidth, gtc: cs.gridTemplateColumns?.slice(0,40) });
  }
  return out;
}, process.argv[3]), null, 1));
await b.close();
