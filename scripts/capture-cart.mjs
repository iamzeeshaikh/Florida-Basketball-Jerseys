// WooCommerce Blocks renders the cart and checkout panels client-side from the
// Store API. Neither can exist on a static host, so the hydrated markup is
// captured here and replayed: the empty panel, a one-line filled panel used as
// the row template, and the checkout panel.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'src', 'data');
const SITE = 'https://floridabasketballjerseys.com';
const b = await chromium.launch();

async function grab(page, sel, name) {
  await page.waitForSelector(sel, { timeout: 60000 });
  await page.waitForTimeout(3500);
  const html = await page.$eval(sel, (el) => el.outerHTML);
  fs.writeFileSync(path.join(OUT, name), html);
  console.log(name, html.length, 'bytes');
}

// empty cart
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const p = await ctx.newPage();
  await p.goto(SITE + '/cart/', { waitUntil: 'load' });
  await grab(p, '.wp-block-woocommerce-cart', 'cart-empty.html');
  await ctx.close();
}
// filled cart + checkout
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const p = await ctx.newPage();
  await p.goto(SITE + '/?add-to-cart=641&quantity=1', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.goto(SITE + '/cart/', { waitUntil: 'load' });
  await grab(p, '.wp-block-woocommerce-cart', 'cart-filled.html');
  await p.goto(SITE + '/checkout/', { waitUntil: 'load' });
  await grab(p, '.wp-block-woocommerce-checkout', 'checkout-filled.html');
  // the checkout page's own head/body wrapper, captured once
  fs.writeFileSync(path.join(ROOT, 'scripts', 'crawl', 'checkout.html'), await p.content());
  console.log('checkout.html page captured');
  await ctx.close();
}
await b.close();
