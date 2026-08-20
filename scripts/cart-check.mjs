/*
 * Cart and checkout behaviour, checked against the markup captured from the
 * live store. WooCommerce Blocks rendered those panels from the Store API, so
 * they are the one part of the site that had to be rebuilt rather than
 * replayed; this asserts the rebuild produces the same DOM and behaves the
 * same way.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.QA_BASE || 'http://localhost:4321';
const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(pass ? '  ok   ' : 'FAIL   ', name, pass ? '' : (detail || ''));
};

function normalise(html) {
  return html
    .replace(/https?:\/\/floridabasketballjerseys\.com/g, '')
    .replace(/http:\/\/localhost:\d+/g, '')
    .replace(/ id=":r[0-9a-z]+:"/g, '')
    .replace(/ aria-controls=":r[0-9a-z]+:"/g, '')
    .replace(/data-cart-item-key="[^"]*"/g, 'data-cart-item-key=""')
    .replace(/\s+/g, ' ')
    .trim();
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const page = await ctx.newPage();

// 1. empty checkout redirects to the cart, as WordPress's 302 did
await page.goto(BASE + '/checkout/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
check('empty /checkout/ lands on /cart/', new URL(page.url()).pathname === '/cart/', page.url());

// 2. empty cart panel
await page.goto(BASE + '/cart/', { waitUntil: 'load' });
await page.waitForTimeout(1200);
const emptyLive = normalise(fs.readFileSync(path.join(ROOT, 'src/data/cart-empty.html'), 'utf8'));
const emptyGot = normalise(await page.$eval('.wp-block-woocommerce-cart', (e) => e.outerHTML));
check('empty cart panel matches live', emptyLive === emptyGot,
      firstDiff(emptyLive, emptyGot));

// 3. add to cart from a product page
await page.goto(BASE + '/product/blank-basketball-jerseys/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.click('a.elementor-button-link');
await page.waitForTimeout(1500);
check('product Add To Cart returns to the product page',
      new URL(page.url()).pathname === '/product/blank-basketball-jerseys/', page.url());

// 4. filled cart panel
await page.goto(BASE + '/cart/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
const filledLive = normalise(fs.readFileSync(path.join(ROOT, 'src/data/cart-filled.html'), 'utf8'));
const filledGot = normalise(await page.$eval('.wp-block-woocommerce-cart', (e) => e.outerHTML));
check('filled cart panel matches live', filledLive === filledGot, firstDiff(filledLive, filledGot));

// 5. quantity controls
await page.click('.wc-block-components-quantity-selector__button--plus');
await page.waitForTimeout(700);
check('quantity + updates the line total',
      (await page.$eval('.wc-block-cart-item__total .wc-block-components-product-price__value', (e) => e.textContent)) === '$8.00');
check('quantity + updates the estimated total',
      (await page.$eval('.wc-block-components-totals-footer-item .wc-block-components-formatted-money-amount', (e) => e.textContent)) === '$8.00');
await page.click('.wc-block-components-quantity-selector__button--minus');
await page.waitForTimeout(700);
check('quantity - restores the total',
      (await page.$eval('.wc-block-components-totals-footer-item .wc-block-components-formatted-money-amount', (e) => e.textContent)) === '$4.00');

// 6. coupon panel
await page.click('.wc-block-components-totals-coupon .wc-block-components-panel__button');
await page.waitForTimeout(500);
check('coupon panel opens', await page.$('.wc-block-components-totals-coupon__form') !== null);

// 7. proceed to checkout
const proceed = await page.$eval('.wc-block-cart__submit-button', (e) => e.getAttribute('href'));
check('Proceed to Checkout points at /checkout/', /\/checkout\/$/.test(proceed), proceed);

// 8. checkout with a line in the cart
await page.goto(BASE + '/checkout/', { waitUntil: 'load' });
await page.waitForTimeout(1800);
check('checkout stays on /checkout/ with a full cart', new URL(page.url()).pathname === '/checkout/');
const coLive = normalise(fs.readFileSync(path.join(ROOT, 'src/data/checkout-filled.html'), 'utf8'));
const coGot = normalise(await page.$eval('.wp-block-woocommerce-checkout', (e) => e.outerHTML));
check('checkout panel matches live', coLive === coGot, firstDiff(coLive, coGot));
check('checkout shows the live store\'s "no payment methods" state',
      (await page.content()).includes('There are no payment methods available'));

// 9. Place Order cannot complete, exactly as on the live store
await page.click('.wc-block-components-checkout-place-order-button');
await page.waitForTimeout(800);
check('Place Order surfaces the no-payment-method error',
      (await page.$eval('.wc-block-components-notices', (e) => e.textContent))
        .includes('There are no payment methods available'));

// 10. remove the line -> empty cart again
await page.goto(BASE + '/cart/', { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.click('.wc-block-cart-item__remove-link');
await page.waitForTimeout(800);
check('removing the last line shows the empty cart',
      (await page.content()).includes('Your cart is currently empty!'));

// 11. archive AJAX add to cart
await page.goto(BASE + '/product/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.click('ul.products li.product a.add_to_cart_button');
await page.waitForTimeout(800);
check('archive Add to cart marks the button and adds a View cart link',
      await page.$('ul.products li.product a.add_to_cart_button.added') !== null &&
      await page.$('ul.products li.product a.added_to_cart') !== null);

function firstDiff(a, b) {
  if (a === b) return '';
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return '\n    live : ' + a.slice(Math.max(0, i - 80), i + 160) +
         '\n    astro: ' + b.slice(Math.max(0, i - 80), i + 160);
}

fs.mkdirSync(path.join(ROOT, 'audit'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audit', 'cart-check.json'), JSON.stringify(results, null, 1));
console.log('\n%d/%d cart checks passed', results.filter((r) => r.pass).length, results.length);
await browser.close();
