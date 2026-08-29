import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [w, tag] of [[1440, 'desktop'], [390, 'mobile']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 1100 } })).newPage();
  await p.goto(process.argv[2], { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1400);
  if (process.argv[4]) await p.evaluate((s) => document.querySelector(s)?.scrollIntoView(), process.argv[4]);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `scratch/${tag}-${process.argv[3] || 'page'}.png`, clip: { x: 0, y: 0, width: w, height: 1100 } });
}
await b.close();
console.log('ok');
