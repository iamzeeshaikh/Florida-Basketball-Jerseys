/*
 * Real end-to-end form test against the deployed staging site.
 *
 * Fills each of the three forms in a browser, submits, and asserts the page
 * reacts the way the live site does AND that the endpoint actually accepted and
 * sent the mail. Every submission is clearly marked as a migration test so the
 * recipients can tell it apart from a customer enquiry.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.argv[2] || 'https://floridabasketballjerseys.vercel.app';
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass: !!pass, detail: pass ? undefined : String(detail ?? '') });
  console.log(pass ? '  ok   ' : 'FAIL   ', name, pass ? '' : String(detail ?? ''));
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });

function watchApi(page, pathname) {
  return new Promise((resolve) => {
    page.on('response', async (r) => {
      if (!r.url().includes(pathname)) return;
      if (r.status() >= 300 && r.status() < 400) return;
      let body = null;
      try { body = await r.json(); } catch { body = await r.text().catch(() => null); }
      resolve({ status: r.status(), body });
    });
    setTimeout(() => resolve({ status: 0, body: 'no response within 45s' }), 45000);
  });
}

// -------------------------------------------------- 1. product Instant Quote
{
  const p = await ctx.newPage();
  await p.goto(BASE + '/product/blank-basketball-jerseys/', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('form.elementor-form').scrollIntoView({ block: 'center' }));
  await p.fill('#form-field-name', 'Migration Test ' + STAMP);
  await p.fill('#form-field-email', 'quotes@example.invalid');
  await p.fill('#form-field-field_f54cfcb', '4075550192');
  await p.fill('#form-field-field_a858f27', 'Blank Basketball Jerseys');
  await p.fill('#form-field-message', 'Automated migration test of the product Instant Quote form. Please ignore.');
  const upload = path.join(ROOT, 'audit', 'test-attachment.txt');
  fs.writeFileSync(upload, 'migration test attachment ' + STAMP + '\n');
  await p.setInputFiles('#form-field-field_e4013ab', upload);
  const api = watchApi(p, '/api/quote');
  await p.click('form.elementor-form button[type="submit"]');
  const r = await api;
  check('product Instant Quote endpoint accepted the submission',
        r.status === 200 && r.body && r.body.success === true, JSON.stringify(r).slice(0, 300));
  await p.waitForTimeout(1500);
  const msg = await p.$eval('form.elementor-form', (f) => f.textContent).catch(() => '');
  check('product form shows Elementor\'s success message',
        msg.includes('The form was sent successfully.'), msg.slice(-160));
  const hidden = await p.$$eval('form.elementor-form input[type=hidden]',
    (els) => Object.fromEntries(els.map((e) => [e.name, e.value])));
  check('product form carries the correct product attribution',
        hidden.referer_title === 'Custom Blank Basketball Jerseys Florida | Florida Basketball Jerseys' &&
        hidden.queried_id === '641', JSON.stringify(hidden));
  await p.close();
}

// ------------------------------------------------------- 2. /get-a-quote/
{
  const p = await ctx.newPage();
  await p.goto(BASE + '/get-a-quote/', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.fill('#fbj-q-name', 'Migration Test ' + STAMP);
  await p.fill('#fbj-q-email', 'quotes@example.invalid');
  await p.fill('#fbj-q-phone', '4075550192');
  await p.fill('#fbj-q-team', 'Migration QA');
  await p.selectOption('#fbj-q-type', { index: 1 });
  await p.selectOption('#fbj-q-qty', { index: 1 });
  await p.fill('#fbj-q-message', 'Automated migration test of the quote form. Please ignore.');
  await p.setInputFiles('#fbj-q-file', path.join(ROOT, 'audit', 'test-attachment.txt'));
  const api = watchApi(p, '/api/quote');
  await p.evaluate(() => document.getElementById('fbj-quote-form').requestSubmit());
  const r = await api;
  // the page navigates to /thank-you/ the moment the endpoint answers success,
  // which can cut the response body short -- the navigation is the real proof
  check('quote form endpoint accepted the submission', r.status === 200,
        JSON.stringify(r).slice(0, 300));
  await p.waitForTimeout(3000);
  check('quote form lands on /thank-you/ exactly as the live form does',
        new URL(p.url()).pathname === '/thank-you/', p.url());
  await p.close();
}

// ----------------------------------------------------------- 3. /contact/
{
  const p = await ctx.newPage();
  await p.goto(BASE + '/contact/', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.fill('#fbj-name', 'Migration Test ' + STAMP);
  await p.fill('#fbj-email', 'quotes@example.invalid');
  await p.fill('#fbj-phone', '4075550192');
  await p.selectOption('#fbj-program', { index: 1 });
  await p.fill('#fbj-message', 'Automated migration test of the contact form. Please ignore.');
  const api = watchApi(p, '/api/contact');
  await p.evaluate(() => document.getElementById('fbj-contact-form').requestSubmit());
  const r = await api;
  check('contact form endpoint accepted the submission',
        r.status === 200 && r.body && r.body.success === true, JSON.stringify(r).slice(0, 300));
  await p.waitForTimeout(1500);
  const visible = await p.$eval('#fbj-con-success-msg', (e) => e.classList.contains('fbj-visible')).catch(() => false);
  check('contact form reveals its success panel', visible);
  await p.close();
}

// ------------------------------------------------- 4. validation still bites
{
  const p = await ctx.newPage();
  await p.goto(BASE + '/contact/', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  let alerted = null;
  p.on('dialog', async (d) => { alerted = d.message(); await d.dismiss(); });
  await p.evaluate(() => document.getElementById('fbj-contact-form').requestSubmit());
  await p.waitForTimeout(1200);
  check('contact form still blocks an empty submission with the live message',
        alerted === 'Please fill in all required fields (Name, Email, Program Type, and Message).', alerted);
  await p.close();
}

await browser.close();
fs.mkdirSync(path.join(ROOT, 'audit'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audit', 'form-e2e.json'), JSON.stringify({ base: BASE, stamp: STAMP, results }, null, 1));
console.log('\n%d/%d form checks passed against %s', results.filter((r) => r.pass).length, results.length, BASE);
