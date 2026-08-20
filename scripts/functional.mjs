/*
 * Functional testing of everything a visitor can click, on the local copy that
 * serves its own assets. Each check states what the live site does and asserts
 * the migrated site does the same.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.QA_BASE || 'http://localhost:4321';
const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass: !!pass, detail: pass ? undefined : String(detail ?? '') });
  console.log(pass ? '  ok   ' : 'FAIL   ', name, pass ? '' : String(detail ?? ''));
};

// one failing assertion must not abort the rest of the sweep
async function step(name, fn) {
  try { await fn(); } catch (e) { check(name, false, e.message.split('\n')[0]); }
}

// The live chat widget opens itself on a timer and the header is sticky; both
// float over the page and would swallow clicks in an automated run. Neither is
// under test here, so they are taken out of the way.
const CLEAR_OVERLAYS = `
  #zee-chat-widget, [id^="zee-chat"] { display: none !important; }
  .elementor-location-header { position: static !important; }
  .elementor-sticky--active { position: static !important; }
`;

async function clickInView(page, selector) {
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), selector);
  await page.waitForTimeout(300);
  await page.click(selector, { timeout: 15000 });
}

const browser = await chromium.launch();

// ---------------------------------------------------------------- desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.addStyleTag({ content: '#zee-chat-widget,[id^="zee-chat"]{display:none !important}' });

  // header dropdowns are CSS hover menus
  const dd = await p.evaluate(() => {
    const item = [...document.querySelectorAll('.fbj-nav-item')].find((i) => i.querySelector('.fbj-nav-dropdown'));
    if (!item) return null;
    const menu = item.querySelector('.fbj-nav-dropdown');
    const before = getComputedStyle(menu).opacity;
    return { before, links: menu.querySelectorAll('a').length };
  });
  check('header has hover dropdowns with links', dd && dd.links > 0, JSON.stringify(dd));
  await p.hover('.fbj-nav-item:nth-child(2) .fbj-nav-link');
  await p.waitForTimeout(500);
  const ddOpen = await p.evaluate(() => {
    const menu = document.querySelector('.fbj-nav-item:nth-child(2) .fbj-nav-dropdown');
    return menu ? getComputedStyle(menu).opacity : null;
  });
  check('hovering a nav item opens its dropdown', ddOpen === '1', 'opacity=' + ddOpen);

  // sticky header
  await p.evaluate(() => window.scrollTo(0, 1200));
  await p.waitForTimeout(900);
  const sticky = await p.evaluate(() => {
    const h = document.getElementById('fbj-hdr');
    const el = document.querySelector('.elementor-location-header .elementor-sticky, .elementor-location-header > div');
    return {
      scrolledClass: h ? h.classList.contains('fbj-hdr-scrolled') : null,
      top: h ? h.getBoundingClientRect().top : null,
      pos: el ? getComputedStyle(el).position : null,
    };
  });
  check('header sticks to the top on scroll', sticky.top !== null && sticky.top < 200, JSON.stringify(sticky));
  check('header gains its scrolled shadow class', sticky.scrolledClass === true, JSON.stringify(sticky));

  // phone + email links
  const tel = await p.$$eval('a[href^="tel:"]', (a) => a.map((x) => x.getAttribute('href'))[0]);
  const mail = await p.$$eval('a[href^="mailto:"]', (a) => a.map((x) => x.getAttribute('href'))[0]);
  check('phone link present and correct', tel === 'tel:+14075550192', tel);
  check('email link present and correct', mail === 'mailto:info@floridabasketballjerseys.com', mail);

  // FAQ accordion on the home page
  await p.goto(BASE + '/faq/', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.addStyleTag({ content: CLEAR_OVERLAYS });
  const faq = await p.evaluate(async () => {
    // the first item is open by default, so the second one is used to test that
    // a click opens a closed item and a second click closes it again
    const btn = document.querySelectorAll('.fbj-faqp-item .fbj-faqp-q')[1];
    if (!btn) return { found: false };
    const item = btn.closest('.fbj-faqp-item');
    btn.click();
    await new Promise((r) => setTimeout(r, 600));
    const opened = item.classList.contains('fbj-faqp-open') && btn.getAttribute('aria-expanded') === 'true';
    btn.click();
    await new Promise((r) => setTimeout(r, 400));
    return { found: true, opened, closed: !item.classList.contains('fbj-faqp-open') };
  });
  check('FAQ accordion opens and closes', faq.found && faq.opened && faq.closed, JSON.stringify(faq));

  // the FAQ page also has category tabs and a live search box
  const faqTabs = await p.evaluate(async () => {
    const tab = document.querySelectorAll('.fbj-faqp-tab')[1];
    if (!tab) return { found: false };
    tab.click();
    await new Promise((r) => setTimeout(r, 400));
    const hidden = [...document.querySelectorAll('.fbj-faqp-group')].filter((g) => g.style.display === 'none').length;
    document.querySelectorAll('.fbj-faqp-tab')[0].click();
    return { found: true, hidden };
  });
  check('FAQ category tabs filter the list', faqTabs.found && faqTabs.hidden > 0, JSON.stringify(faqTabs));
  const faqSearch = await p.evaluate(async () => {
    const input = document.getElementById('fbj-faqp-search');
    if (!input) return { found: false };
    input.value = 'reversible';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const shown = [...document.querySelectorAll('.fbj-faqp-item')].filter((i) => i.style.display !== 'none').length;
    const all = document.querySelectorAll('.fbj-faqp-item').length;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { found: true, shown, all };
  });
  check('FAQ search narrows the list', faqSearch.found && faqSearch.shown > 0 && faqSearch.shown < faqSearch.all,
        JSON.stringify(faqSearch));

  // product page: gallery, tabs, related products
  await p.goto(BASE + '/product/blank-basketball-jerseys/', { waitUntil: 'load' });
  await p.waitForTimeout(3000);
  await p.addStyleTag({ content: CLEAR_OVERLAYS });
  check('product gallery initialised as a slider',
        await p.$('.woocommerce-product-gallery .flex-viewport') !== null);
  const thumbs = await p.$$('.flex-control-thumbs li');
  check('gallery thumbnails present', thumbs.length === 5, 'count=' + thumbs.length);
  if (thumbs.length > 1) await step('gallery thumbnail switches the slide', async () => {
    const first = await p.$eval('.woocommerce-product-gallery__image.flex-active-slide img', (e) => e.src);
    await clickInView(p, '.flex-control-thumbs li:nth-child(3) img');
    await p.waitForTimeout(1200);
    const after = await p.$eval('.woocommerce-product-gallery__image.flex-active-slide img', (e) => e.src);
    check('clicking a thumbnail changes the active slide', first !== after, first + ' -> ' + after);
  });
  check('lightbox trigger present',
        await p.$('.woocommerce-product-gallery__trigger') !== null);

  // the tab strip sits inside an Elementor entrance-animation section, which
  // stays visibility:hidden until it scrolls into view -- same as the live page
  await p.evaluate(() => document.querySelector('.woocommerce-tabs')?.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(1200);
  const tabs = await p.$$('.woocommerce-tabs ul.tabs li');
  check('product tabs present (Specifications, Faqs)', tabs.length === 2, 'count=' + tabs.length);
  if (tabs.length === 2) await step('product tabs interaction', async () => {
    await clickInView(p, '.woocommerce-tabs ul.tabs li:nth-child(2) a');
    await p.waitForTimeout(600);
    const visible = await p.evaluate(() => {
      const el = document.querySelector('#tab-faqs_tab');
      return el ? getComputedStyle(el).display !== 'none' : null;
    });
    check('clicking the Faqs tab shows its panel', visible === true, String(visible));
    const acc = await p.evaluate(async () => {
      const h = document.querySelector('#tab-faqs_tab > h3');
      if (!h) return { found: false };
      h.click();
      await new Promise((r) => setTimeout(r, 500));
      return { found: true, open: h.classList.contains('faq-active') };
    });
    check('product FAQ accordion opens', acc.found ? acc.open : false, JSON.stringify(acc));
  });
  check('related products rendered',
        (await p.$$('section.related.products li.product')).length > 0);

  // quote buttons
  const quoteLinks = await p.$$eval('a[href$="/get-a-quote"], a[href$="/get-a-quote/"]', (a) => a.length);
  check('quote CTA links present', quoteLinks > 0, 'count=' + quoteLinks);

  // the chat widget script is the live site's, loaded from its own host
  check('chat widget script present',
        (await p.content()).includes('chat.zeeops.dev/widget.js'));

  // sorting
  await step('archive sorting', async () => {
  await p.goto(BASE + '/product/?orderby=price-desc', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const sorted = await p.$eval('select.orderby', (s) => s.value);
  check('archive sorting selects the requested order', sorted === 'price-desc', sorted);
  check('archive still lists 16 tiles when sorted',
        (await p.$$('ul.products li.product')).length === 16);
  });

  // search
  await p.goto(BASE + '/?s=mesh&post_type=product', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const found = await p.$$('ul.products li.product');
  check('product search returns the live result set (3 for "mesh")', found.length === 3, 'count=' + found.length);
  check('search heading shows the term',
        (await p.$eval('.woocommerce-products-header__title', (e) => e.textContent)).includes('mesh'));

  // 404
  const r404 = await p.goto(BASE + '/definitely-not-a-page/', { waitUntil: 'load' });
  check('unknown URL returns 404 with the site\'s error page',
        r404.status() === 404 && (await p.content()).includes('That page can’t be found'),
        'status=' + r404.status());

  // mixed-case URL, which WordPress served as 200
  const rCase = await p.goto(BASE + '/About/', { waitUntil: 'load' });
  check('mixed-case URL serves the page with 200',
        rCase.status() === 200 && (await p.title()).startsWith('About'), 'status=' + rCase.status());

  await ctx.close();
}

// ----------------------------------------------------------------- mobile
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.addStyleTag({ content: '#zee-chat-widget,[id^="zee-chat"]{display:none !important}' });
  const burger = await p.$('#fbj-burger');
  check('mobile menu button present', burger !== null);
  if (burger) {
    const box = await burger.boundingBox();
    check('mobile menu button has a real hit area', box && box.width > 20 && box.height > 20, JSON.stringify(box));
    await burger.click({ force: true });
    await p.waitForTimeout(600);
    const open = await p.evaluate(() => {
      const m = document.getElementById('fbj-mobile-menu');
      return m ? { open: m.classList.contains('fbj-open'), aria: m.getAttribute('aria-hidden'),
                   links: m.querySelectorAll('a').length } : null;
    });
    check('mobile menu opens with its links', open && open.open && open.links > 0, JSON.stringify(open));
    await burger.click({ force: true });
    await p.waitForTimeout(500);
    const closed = await p.evaluate(() => document.getElementById('fbj-mobile-menu').classList.contains('fbj-open'));
    check('mobile menu closes again', closed === false, String(closed));
  }
  await ctx.close();
}

await browser.close();
fs.mkdirSync(path.join(ROOT, 'audit'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audit', 'functional.json'), JSON.stringify(results, null, 1));
console.log('\n%d/%d functional checks passed', results.filter((r) => r.pass).length, results.length);
