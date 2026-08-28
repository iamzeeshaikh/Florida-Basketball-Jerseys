/*
 * Assert that the build actually did what the transforms claim to do.
 *
 * This exists because of a silent failure. The image transform ran on every
 * page, found no convertible images because this site prints absolute URLs
 * and the lookup expected relative ones, wrapped nothing, and reported
 * success. A transform that produces zero effect looks exactly like a
 * transform that had nothing to do, and neither the build nor my eye could
 * tell them apart.
 *
 * Every check below is a claim made elsewhere in the codebase. If one stops
 * being true, this fails the build rather than shipping quietly.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') pages.push(p);
  }
})(DIST);

const problems = [];
const stat = { pages: pages.length, imgs: 0, wrapped: 0, emptyAlt: 0, noLoading: 0, faq: 0, crumbs: 0, british: 0, inlineFontImport: 0 };

const BRITISH = /\b(colour\w*|fibre\w*|programme\w*|centre\w*|customis\w*|organis\w*|specialis\w*|favourite\w*|behaviour\w*|centimetre\w*)\b/i;

for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(DIST, path.dirname(file));
  const route = rel === '' ? '/' : `/${rel}/`;

  stat.imgs += (html.match(/<img\b/g) || []).length;
  stat.wrapped += (html.match(/<picture><source/g) || []).length;
  for (const tag of html.match(/<img\b[^>]*>/g) || []) {
    const alt = /\balt\s*=\s*"([^"]*)"/.exec(tag);
    if (alt && !alt[1].trim()) stat.emptyAlt++;
    if (!/\bloading\s*=/.test(tag)) stat.noLoading++;
  }
  if (html.includes('"FAQPage"')) stat.faq++;
  if (html.includes('BreadcrumbList')) stat.crumbs++;
  if (/@import\s+url\(\s*['"]?https:\/\/fonts\.googleapis/.test(html)) stat.inlineFontImport++;

  const withoutAria = html.replace(/aria-labelledby/g, '');
  if (BRITISH.test(withoutAria)) { stat.british++; if (problems.length < 6) problems.push(`${route} — British spelling`); }

  // A product page shows FAQs; it must also publish them.
  const looksProduct = route.startsWith('/product/') && !route.includes('/page/') && route !== '/product/';
  const visibleFaqs = (html.match(/<h3[^>]*>[^<]{6,160}\?<\/h3>/g) || []).length;
  if (looksProduct && visibleFaqs >= 3 && !html.includes('"FAQPage"')) {
    problems.push(`${route} — ${visibleFaqs} FAQs shown to readers, none marked up`);
  }
  // The home page is the root of the trail, so it has no trail. Cart, checkout
  // and thank-you are steps in a flow rather than places in a hierarchy, and a
  // breadcrumb on them would describe a structure that does not exist.
  const FLOW = ['/', '/cart/', '/checkout/', '/thank-you/', '/my-account/'];
  if (!html.includes('BreadcrumbList') && !FLOW.includes(route)) {
    problems.push(`${route} — no BreadcrumbList`);
  }
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
console.log(`${stat.pages} pages, ${stat.imgs} images`);
console.log(`  wrapped in <picture> : ${stat.wrapped} (${pct(stat.wrapped, stat.imgs)}%)`);
console.log(`  empty alt            : ${stat.emptyAlt}`);
console.log(`  missing loading      : ${stat.noLoading}`);
console.log(`  FAQPage pages        : ${stat.faq}`);
console.log(`  BreadcrumbList pages : ${stat.crumbs}`);
console.log(`  inline font @import  : ${stat.inlineFontImport}`);
console.log(`  British spellings    : ${stat.british}`);

// The zero-effect guard: if a transform is wired up it must have done something.
if (stat.imgs > 0 && stat.wrapped === 0) problems.push('image transform wrapped NOTHING — it is wired up but doing nothing');
if (stat.emptyAlt > 0) problems.push(`${stat.emptyAlt} images still have an empty alt`);
if (stat.noLoading > 0) problems.push(`${stat.noLoading} images have no loading attribute`);
if (stat.inlineFontImport > 0) problems.push(`${stat.inlineFontImport} pages still request fonts via @import inside <style>`);
if (stat.wrapped && pct(stat.wrapped, stat.imgs) < 90) problems.push(`only ${pct(stat.wrapped, stat.imgs)}% of images are WebP-wrapped`);

if (problems.length === 0) { console.log('\nall build assertions pass'); }
else {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 20)) console.log('  ', p);
  if (problems.length > 20) console.log(`   … and ${problems.length - 20} more`);
  process.exit(1);
}
