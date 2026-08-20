// Second mirroring pass: render a sample of live pages in a browser and copy
// every same-origin asset they actually request. Static parsing misses what
// JavaScript pulls in at runtime -- Elementor lazy-loads webpack chunks, and
// stylesheets pull fonts and sprites.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE = 'https://floridabasketballjerseys.com';
const PAGES = [
  '/', '/about/', '/contact/', '/faq/', '/get-a-quote/', '/how-it-works/', '/sitemap/',
  '/product/', '/product-category/basketball-shirts/', '/brand/florida-basketball-jerseys/',
  '/product/blank-basketball-jerseys/', '/cart/', '/my-account/', '/my-account/lost-password/',
  '/thank-you/', '/privacy-policy/',
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const wanted = new Set();
for (const route of PAGES) {
  const page = await ctx.newPage();
  page.on('response', (r) => {
    const u = r.url();
    if (!u.startsWith(SITE)) return;
    const p = new URL(u).pathname;
    if (!/^\/(wp-content|wp-includes)\//.test(p)) return;
    if (r.status() === 200) wanted.add(p);
  });
  await page.goto(SITE + route, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(2000);
  // scroll so lazily-initialised widgets pull their chunks
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 900) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);
  await page.close();
  console.log(route, wanted.size);
}
await browser.close();

let added = 0;
for (const p of [...wanted].sort()) {
  const dest = path.join(ROOT, 'public', p.replace(/^\//, ''));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const code = execFileSync('curl', ['-sS', '-L', '--max-time', '90', '-o', dest, '-w', '%{http_code}', SITE + p])
    .toString().trim();
  if (code !== '200') { fs.rmSync(dest, { force: true }); console.log('  !!', p, code); continue; }
  added++;
  console.log('  +', p);
}
console.log('added', added, 'of', wanted.size, 'runtime assets');
