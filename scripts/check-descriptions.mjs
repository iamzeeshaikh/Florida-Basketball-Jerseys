/*
 * Audit the Description tab on every product page, against the linking rules
 * and the formatting brief, reading the BUILT html rather than the source.
 *
 * Every rule here exists because breaking it is easy and invisible:
 *
 *   1. At most ONE internal link per paragraph, and per list item. Two links
 *      in one paragraph read as a link farm and dilute both anchors.
 *   2. Anchor text 3-8 words, descriptive of the destination. A bare product
 *      name tells a reader nothing they did not already know.
 *   3. No generic anchors -- "click here", "learn more", "read more" and the
 *      rest of the list, which describe the act of clicking rather than what
 *      is on the other side.
 *   4. Every href resolves to a page that exists in dist/. The route list is
 *      read from what was actually built, so a link written from memory
 *      cannot survive.
 *   5. Every internal URL ends in a trailing slash. This site redirects to
 *      the slashed form, so a link without one costs a redirect on every
 *      click.
 *   6. No anchor text repeated within a description, and no destination
 *      linked twice from the same page.
 *   7. At least 1,000 words.
 *   8. Exactly one <ul> and exactly one <ol>. Mixed formatting, bounded --
 *      a page of nothing but bullets is as unreadable as a page with none.
 *   9. Headings unique across the whole catalogue. A heading repeated on 23
 *      pages is a template announcing itself.
 *
 * Run after `astro build`. Exits non-zero on any violation.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const ORIGIN = 'floridabasketballjerseys.com';
const PANEL = /<div class="fbj-pd">([\s\S]*?)<\/div>\s*<\/div>/;
const GENERIC = /^(click here|here|learn more|read more|see more|view more|explore(\s+\w+)*|discover(\s+\w+)*|visit this page|check (this|it) out|our (solutions|services|products|range|collection)|related page|this page|shop now|more info(rmation)?)$/i;

function routes() {
  const found = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html') {
        found.add(`/${path.relative(DIST, dir)}/`.replace(/^\/\//, '/'));
      }
    }
  };
  walk(DIST);
  found.add('/');
  return found;
}

const known = routes();
const problems = [];
const headings = new Map();          // heading -> [routes]
const files = fs.readdirSync(path.join(DIST, 'product'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => path.join(DIST, 'product', e.name, 'index.html'))
  .filter((f) => fs.existsSync(f));

let checked = 0;
let totalWords = 0;
let totalLinks = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const where = `/product/${path.basename(path.dirname(file))}/`;
  const m = PANEL.exec(html);
  if (!m) { problems.push(`${where} — no description tab`); continue; }
  const body = m[1];
  checked++;

  const words = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
  totalWords += words;
  if (words < 1000) problems.push(`${where} — description is ${words} words, needs 1000`);

  const uls = (body.match(/<ul\b/g) || []).length;
  const ols = (body.match(/<ol\b/g) || []).length;
  if (uls !== 1) problems.push(`${where} — ${uls} bulleted lists, expected exactly 1`);
  if (ols !== 1) problems.push(`${where} — ${ols} numbered lists, expected exactly 1`);

  for (const h of body.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g) || []) {
    const text = h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (/<a\b/.test(h)) problems.push(`${where} — link inside a heading: "${text}"`);
    if (!headings.has(text)) headings.set(text, []);
    headings.get(text).push(where);
  }

  // One link per paragraph AND per list item.
  const anchors = [];
  const dests = [];
  for (const blockMatch of body.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const inner = blockMatch[2];
    const links = [...inner.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const internal = links.filter(([, href]) => href.startsWith('/') || href.includes(ORIGIN));
    totalLinks += internal.length;
    if (internal.length > 1) {
      problems.push(`${where} — ${internal.length} links in one ${blockMatch[1]}: `
        + internal.map((l) => l[2].replace(/<[^>]+>/g, '')).join(' | '));
    }
    for (const [, href, anchorHtml] of internal) {
      const anchor = anchorHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const n = anchor.split(' ').filter(Boolean).length;
      if (n < 3 || n > 8) problems.push(`${where} — anchor is ${n} words, needs 3-8: "${anchor}"`);
      if (GENERIC.test(anchor)) problems.push(`${where} — generic anchor: "${anchor}"`);
      anchors.push(anchor.toLowerCase());

      let p = href.replace(new RegExp(`^https?://${ORIGIN.replace('.', '\\.')}`), '').split('#')[0].split('?')[0];
      if (!p.startsWith('/')) continue;
      if (!p.endsWith('/') && !/\.\w+$/.test(p)) {
        problems.push(`${where} — internal URL without a trailing slash: ${href}`);
        p += '/';
      }
      if (!known.has(p)) problems.push(`${where} — link to a page that does not exist: ${href}`);
      dests.push(p);
    }
  }

  for (const [a, n] of countOf(anchors)) {
    if (n > 1) problems.push(`${where} — anchor text used ${n} times: "${a}"`);
  }
  for (const [d, n] of countOf(dests)) {
    if (n > 1) problems.push(`${where} — links to ${d} ${n} times`);
  }
}

function countOf(list) {
  const m = new Map();
  for (const x of list) m.set(x, (m.get(x) || 0) + 1);
  return [...m];
}

for (const [text, where] of headings) {
  if (where.length > 1) problems.push(`heading repeated on ${where.length} pages: "${text}" (${where[0]} …)`);
}

console.log(`${checked}/${files.length} product pages have a description`);
if (checked) {
  console.log(`  ${totalWords.toLocaleString()} words, ${Math.round(totalWords / checked)} average`);
  console.log(`  ${totalLinks} internal links, ${headings.size} distinct headings`);
}
if (problems.length === 0) {
  console.log('all description rules pass');
} else {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.log('  ', p);
  if (problems.length > 40) console.log(`   … and ${problems.length - 40} more`);
  process.exit(1);
}
