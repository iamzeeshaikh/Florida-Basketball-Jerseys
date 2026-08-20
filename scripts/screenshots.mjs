/*
 * Visual audit: full-page screenshots of the WordPress page and the Astro page
 * at the same widths, then a pixel diff.
 *
 * Both sides are served from the QA origin so they load the same local copies
 * of every asset. Three things have to be pinned first or the comparison is
 * noise: infinite CSS animations (the header dot, the footer shimmer, the
 * product trust bar) are frozen at frame 0, Elementor's entrance animations are
 * forced to their finished state, and lazy images are made eager -- Chrome
 * drops a lazy image's load once it leaves the viewport again.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.QA_BASE || 'http://localhost:4321';
const SHOTS = path.join(ROOT, 'audit', 'shots');
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pages.json'), 'utf8'));

// one page of every distinct template, shot at every width
const SAMPLE = new Set([
  '/', '/about/', '/how-it-works/', '/faq/', '/contact/', '/get-a-quote/', '/thank-you/',
  '/sitemap/', '/terms-of-service/', '/privacy-policy/', '/refund-policy/',
  '/shipping-policy/', '/cookie-policy/', '/disclaimer/', '/product/',
  '/product-category/basketball-shirts/', '/brand/florida-basketball-jerseys/',
  '/product/blank-basketball-jerseys/', '/my-account/', '/my-account/lost-password/',
  '/search/', '/product/page/2/',
]);
const WIDTHS = [
  { w: 1440, all: true },
  { w: 768, all: false },
  { w: 390, all: false },
  { w: 320, all: false },
];

const FREEZE = `
  /* the live chat widget opens itself on a timer of its own; it is present on
     both sides and its open/closed state is not a migration difference */
  #zee-chat-widget, #zee-chat-launcher, [id^="zee-chat"] { display: none !important; }
  *, *::before, *::after {
    animation-play-state: paused !important;
    animation-delay: 0s !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

async function shoot(url, file, width) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: FREEZE });
    await page.evaluate(async () => {
      document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
      // Elementor reveals entrance animations on scroll; land them all
      document.querySelectorAll('.elementor-invisible').forEach((e) => e.classList.remove('elementor-invisible'));
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
      await Promise.all([...document.images].filter((i) => !i.complete)
        .map((i) => new Promise((res) => { i.onload = i.onerror = res; })));
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file, fullPage: true });
  } finally {
    await browser.close();
  }
}

function diff(a, b, out) {
  const A = PNG.sync.read(fs.readFileSync(a));
  const B = PNG.sync.read(fs.readFileSync(b));
  const w = Math.min(A.width, B.width);
  const h = Math.min(A.height, B.height);
  const crop = (img) => {
    const c = new PNG({ width: w, height: h });
    PNG.bitblt(img, c, 0, 0, w, h, 0, 0);
    return c;
  };
  const ca = crop(A), cb = crop(B);
  const d = new PNG({ width: w, height: h });
  const n = pixelmatch(ca.data, cb.data, d.data, w, h, { threshold: 0.12 });
  const pct = (n / (w * h)) * 100;
  if (n) fs.writeFileSync(out, PNG.sync.write(d));
  return { pixels: n, pct, sizeMismatch: A.width !== B.width || A.height !== B.height,
           live: [A.width, A.height], astro: [B.width, B.height] };
}

fs.mkdirSync(SHOTS, { recursive: true });
const report = [];
for (const { w, all } of WIDTHS) {
  for (const page of Object.values(pages)) {
    const route = page.route;
    if (route === '/404/') continue;
    if (!all && !SAMPLE.has(route)) continue;
    const slug = (route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '__'));
    const liveFile = path.join(SHOTS, `${slug}.${w}.live.png`);
    const astroFile = path.join(SHOTS, `${slug}.${w}.astro.png`);
    try {
      if (!fs.existsSync(liveFile)) await shoot(`${BASE}/__live${route}`, liveFile, w);
      if (!fs.existsSync(astroFile)) await shoot(`${BASE}${route}`, astroFile, w);
      const d = diff(liveFile, astroFile, path.join(SHOTS, `${slug}.${w}.diff.png`));
      report.push({ route, width: w, ...d });
      console.log(`${d.pct < 0.01 ? '  ok  ' : 'DIFF  '} ${w}px ${route} ${d.pct.toFixed(3)}% ` +
        (d.sizeMismatch ? `size live=${d.live} astro=${d.astro}` : ''));
    } catch (e) {
      report.push({ route, width: w, error: e.message });
      console.log('ERR   ', w, route, e.message);
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'audit', 'screenshots.json'), JSON.stringify(report, null, 1));
const bad = report.filter((r) => r.error || r.pct >= 0.01);
console.log('\n%d/%d shots identical', report.length - bad.length, report.length);
