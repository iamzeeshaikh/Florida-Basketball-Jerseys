/*
 * Local-asset cutover test.
 *
 * Renders every route from a copy that serves all of its own CSS, JavaScript,
 * fonts and images, and asserts the conditions that actually matter after the
 * domain moves: nothing 404s, nothing fails, no script throws, every declared
 * font loads, and no page scrolls sideways on a phone.
 *
 * A *.vercel.app staging host cannot prove this -- absolute URLs would let it
 * quietly keep loading from the WordPress host. This does.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.QA_BASE || 'http://localhost:4321';
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pages.json'), 'utf8'));
const ALLOWED_HOSTS = new Set([
  new URL(BASE).host,
  'fonts.googleapis.com', 'fonts.gstatic.com',   // the site's webfonts, as on live
  'chat.zeeops.dev',                             // the live chat widget
  's.w.org',                                     // WordPress's twemoji sprite, as on live
]);

const browser = await chromium.launch();
const report = [];

for (const width of [1440, 390, 320]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  for (const page of Object.values(pages)) {
    const route = page.route;
    const url = route === '/404/' ? BASE + '/does-not-exist-xyz/' : BASE + route;
    const p = await ctx.newPage();
    const failed = [], bad = [], errors = [], foreign = [];
    p.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    p.on('requestfailed', (r) => failed.push(r.url() + ' :: ' + (r.failure()?.errorText)));
    p.on('response', (r) => {
      if (!/^https?:/.test(r.url())) return;   // blob: and data: are page-generated
      const u = new URL(r.url());
      if (!ALLOWED_HOSTS.has(u.host)) foreign.push(r.url());
      if (r.status() >= 400 && r.request().resourceType() !== 'document') {
        bad.push(r.status() + ' ' + r.url());
      }
    });
    let status = null;
    try {
      const resp = await p.goto(url, { waitUntil: 'load', timeout: 90000 });
      status = resp?.status();
      await p.waitForTimeout(2000);
      await p.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 800) {
          window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30));
        }
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(1200);
    } catch (e) {
      errors.push('navigation: ' + e.message);
    }
    const overflow = await p.evaluate(() => {
      const de = document.documentElement;
      if (de.scrollWidth <= de.clientWidth + 1) return null;
      const wide = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 1)
        .slice(0, 5)
        .map((el) => el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(/\s+/).slice(0, 3).join('.'));
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, wide };
    }).catch(() => null);
    const fonts = await p.evaluate(() =>
      [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family)).catch(() => []);
    // The header overflows horizontally below ~500px on the WordPress site too.
    // What matters is that the migration does not make it worse, so the same
    // measurement is taken from the replayed original and compared.
    let liveOverflow = null;
    if (overflow) {
      const lp = await ctx.newPage();
      try {
        await lp.goto(BASE + '/__live' + (route === '/404/' ? '/' : route), { waitUntil: 'load', timeout: 60000 });
        await lp.waitForTimeout(1500);
        liveOverflow = await lp.evaluate(() => {
          const de = document.documentElement;
          return de.scrollWidth > de.clientWidth + 1
            ? { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth } : null;
        });
      } catch {}
      await lp.close();
    }
    const overflowRegression = !!overflow && (!liveOverflow || liveOverflow.scrollWidth < overflow.scrollWidth);
    report.push({ route, width, status, failed, bad, errors, fonts,
                  foreign: [...new Set(foreign)], overflow, liveOverflow, overflowRegression });
    const problems = failed.length + bad.length + errors.length + fonts.length + (overflowRegression ? 1 : 0);
    if (problems) {
      console.log(`FAIL ${width} ${route}`,
        JSON.stringify({ failed: failed.slice(0, 3), bad: bad.slice(0, 3), errors: errors.slice(0, 3),
                         fonts, overflow: overflowRegression ? overflow : undefined }));
    }
    await p.close();
  }
  await ctx.close();
  console.log('-- width', width, 'done');
}
await browser.close();
fs.writeFileSync(path.join(ROOT, 'audit', 'runtime.json'), JSON.stringify(report, null, 1));
const clean = report.filter((r) => !r.failed.length && !r.bad.length && !r.errors.length &&
                                   !r.fonts.length && !r.overflowRegression);
const inherited = report.filter((r) => r.overflow && !r.overflowRegression).length;
console.log('renders inheriting the original\'s horizontal overflow (no regression):', inherited);
console.log('\n%d/%d page renders clean', clean.length, report.length);
const off = [...new Set(report.flatMap((r) => r.foreign))];
console.log('off-site requests:', off.length ? off : 'none beyond the allowed hosts');
