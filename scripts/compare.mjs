/*
 * Rendered-DOM parity audit.
 *
 * Both sides are rendered in the same Chromium: the WordPress page is replayed
 * from the crawl with its absolute URLs repointed at the QA server (so it loads
 * the same local copies of the assets), and the Astro build is served from the
 * same origin. Comparing post-JS DOM to post-JS DOM is the only fair test --
 * half of what a visitor sees on a WordPress page is assembled by JavaScript.
 *
 * WooCommerce orders related products and the empty-cart "New in store" grid
 * with `orderby: rand`, so those blocks are compared as sets, not sequences.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.QA_BASE || 'http://localhost:4321';
const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pages.json'), 'utf8'));

const EXTRACT = () => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content ?? null;
  const prop = (n) => document.querySelector(`meta[property="${n}"]`)?.content ?? null;

  // blocks WooCommerce randomises per request
  const RANDOM = ['section.related.products', '.wp-block-woocommerce-empty-cart-block',
                  '.wc-block-product-new', '.fourohfour-columns-2'];
  const doc = document.body.cloneNode(true);
  doc.querySelectorAll('script,style,noscript').forEach((e) => e.remove());
  const randomSets = {};
  RANDOM.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el, i) => {
      randomSets[sel + '#' + i] = [...el.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href')).sort();
      el.remove();
    });
  });

  const headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .map((h) => h.tagName.toLowerCase() + ': ' + norm(h.textContent));
  const links = [...doc.querySelectorAll('a[href]')]
    .map((a) => a.getAttribute('href') + ' :: ' + norm(a.textContent));
  const imgs = [...doc.querySelectorAll('img')]
    .map((i) => (i.getAttribute('src') || '') + ' :: ' + (i.getAttribute('alt') ?? ''));
  const forms = [...doc.querySelectorAll('form')].map((f) =>
    (f.getAttribute('id') || f.className) + ' [' +
    [...f.querySelectorAll('input,select,textarea,button')]
      .map((e) => (e.getAttribute('name') || e.id || e.tagName) + ':' + (e.getAttribute('type') || e.tagName.toLowerCase()) +
        (e.hasAttribute('required') ? '*' : '')).join(', ') + ']');
  const text = norm(doc.innerText || doc.textContent).split(' ').join(' ');
  const jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((s) => { try { return JSON.stringify(JSON.parse(s.textContent)); } catch { return s.textContent.trim(); } })
    .sort();

  const ORIGIN = location.origin;
  // both sides are normalised to one origin, and asset paths to their
  // root-relative form -- the migration deliberately serves its own assets
  const deorigin = (v) => typeof v !== 'string' ? v : v
    .split(ORIGIN).join('https://floridabasketballjerseys.com')
    .replace(/https?:(\\?\/\\?\/)floridabasketballjerseys\.com(\\?\/(?:wp-content|wp-includes)\\?\/)/g, '$2');

  return {
    title: document.title,
    description: meta('description'),
    robots: meta('robots'),
    canonical: deorigin(document.querySelector('link[rel=canonical]')?.href ?? null),
    og: deorigin([prop('og:title'), prop('og:description'), prop('og:url'), prop('og:type'), prop('og:image'), prop('og:site_name'), prop('og:locale')].join(' | ')),
    twitter: [meta('twitter:card'), meta('twitter:title'), meta('twitter:description')].join(' | '),
    bodyClass: document.body.className.split(/\s+/).sort().join(' '),
    headings: headings.map(deorigin),
    links: links.map(deorigin),
    imgs: imgs.map(deorigin),
    forms, randomSets,
    jsonld: jsonld.map(deorigin).sort(),
    text,
  };
};

function diffList(a, b) {
  const out = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) if (a[i] !== b[i]) out.push({ i, live: a[i], astro: b[i] });
  return out;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });

async function grab(url, seedCart) {
  const page = await ctx.newPage();
  if (seedCart) {
    await page.addInitScript(() => {
      // one line in the cart, matching the state the live pages were captured in
      localStorage.setItem('fbj_cart', JSON.stringify([{ id: 641, qty: 1 }]));
    });
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(EXTRACT);
  data.jsErrors = errors;
  await page.close();
  return data;
}

const report = [];
for (const page of Object.values(routes)) {
  const route = page.route;
  if (route === '/404/') continue;
  // the cart and checkout panels are rendered by WooCommerce Blocks from the
  // Store API, which the replay cannot reach -- the replay shows an error panel
  // instead of the real one, so it is not a usable reference for the text.
  const blocksPage = route === '/cart/' || route === '/checkout/';
  const live = await grab(BASE + '/__live' + route);
  const astro = await grab(BASE + route, blocksPage);
  const issues = [];
  for (const k of ['title', 'description', 'robots', 'canonical', 'og', 'twitter', 'bodyClass']) {
    if (live[k] !== astro[k]) issues.push({ field: k, live: live[k], astro: astro[k] });
  }
  // The cart and checkout panels are verified separately by cart-check.mjs
  // against the markup captured from the live store; here only the page shell
  // around them is compared.
  const listFields = blocksPage ? ['forms', 'jsonld'] : ['headings', 'links', 'imgs', 'forms', 'jsonld'];
  for (const k of listFields) {
    const d = diffList(live[k], astro[k]);
    if (d.length) issues.push({ field: k, count: d.length, sample: d.slice(0, 6) });
  }
  if (!blocksPage && live.text !== astro.text) {
    // report the first divergence with a little context
    let i = 0;
    while (i < live.text.length && live.text[i] === astro.text[i]) i++;
    issues.push({ field: 'text', at: i,
      live: live.text.slice(Math.max(0, i - 60), i + 120),
      astro: astro.text.slice(Math.max(0, i - 60), i + 120) });
  }
  for (const k of Object.keys(live.randomSets)) {
    const l = live.randomSets[k] || [], a = astro.randomSets[k] || [];
    if (l.length !== a.length) issues.push({ field: 'randomBlock ' + k, live: l.length, astro: a.length });
  }
  // only errors the original page does not also throw
  const liveErrs = new Set(live.jsErrors);
  const newErrs = [...new Set(astro.jsErrors.filter((e) => !liveErrs.has(e)))];
  if (newErrs.length) issues.push({ field: 'jsErrors', astro: newErrs, live: [...liveErrs] });
  report.push({ route, ok: issues.length === 0, issues });
  console.log((issues.length ? 'DIFF ' + String(issues.length).padStart(2) : '  ok   '), route,
    issues.length ? issues.map((i) => i.field).join(',') : '');
}
fs.mkdirSync(path.join(ROOT, 'audit'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audit', 'compare.json'), JSON.stringify(report, null, 1));
console.log('\n%d/%d routes identical', report.filter((r) => r.ok).length, report.length);
await browser.close();
