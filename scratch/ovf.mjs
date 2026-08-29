import { chromium } from 'playwright';
import fs from 'node:fs';
const routes = process.argv.slice(2);
const b = await chromium.launch();
const bad = [];
for (const w of [1440, 768, 390, 320]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  for (const r of routes) {
    await page.goto(`http://localhost:4471${r}`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) { bad.push(`${w}px ${r} — ${over}px`); console.log(`  ${w}px ${r} — ${over}px`); }
  }
  console.log(`${w}px — ${routes.length} routes`);
  await ctx.close();
}
await b.close();
console.log(bad.length ? `${bad.length} problems` : 'no page scrolls sideways at any width');
