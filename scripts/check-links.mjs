/*
 * Enforce the internal-linking rules against the BUILT html, not the source.
 *
 * Three rules, and each one exists because breaking it has cost us before:
 *
 *   1. At most ONE internal link per paragraph. Two links in a paragraph read
 *      as a link farm to a person and dilute both anchors for a crawler.
 *   2. Anchor text of three to eight words, descriptive of the destination.
 *      "click here", "this page" and a bare product name all fail the point of
 *      an anchor, which is to tell the reader where they are about to go.
 *   3. Every href resolves to a page that exists in dist/. A link written from
 *      memory rather than from the route list is how 42 product pages ended up
 *      pointing at /product/practice-basketball-jerseys/, which has never
 *      existed.
 *
 * Run after `astro build`. Exits non-zero on any violation.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const SCOPE = process.argv[2] || 'blog';        // which directory of pages to check

function routes() {
  const found = new Set(['/']);
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html') found.add(`/${path.relative(DIST, dir)}/`.replace(/^\/\//, '/'));
    }
  };
  walk(DIST);
  return found;
}

function pages(scope) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html') out.push(p);
    }
  };
  walk(path.join(DIST, scope));
  return out;
}

const known = routes();
const problems = [];
let paras = 0, links = 0;

// Only the article body — the header, footer and CTA are chrome and are
// allowed to carry as many links as they like.
const BODY = /<div class="fbj-bl-body">([\s\S]*?)<section class="fbj-bl-cta">/;
const PARA = /<p[^>]*>([\s\S]*?)<\/p>/g;
const LINK = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

for (const file of pages(SCOPE)) {
  const html = fs.readFileSync(file, 'utf8');
  const body = BODY.exec(html);
  if (!body) continue;
  const where = `/${path.relative(DIST, path.dirname(file))}/`;

  for (const [, inner] of body[1].matchAll(PARA)) {
    paras++;
    const found = [...inner.matchAll(LINK)];
    const internal = found.filter(([, href]) => href.startsWith('/') || href.includes('floridabasketballjerseys.com'));
    links += internal.length;

    if (internal.length > 1) {
      problems.push(`${where} — ${internal.length} links in one paragraph: ${internal.map((m) => m[2].replace(/<[^>]+>/g, '')).join(' | ')}`);
    }
    for (const [, href, anchorHtml] of internal) {
      const anchor = anchorHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const words = anchor.split(' ').filter(Boolean).length;
      if (words < 3 || words > 8) problems.push(`${where} — anchor is ${words} words, needs 3-8: "${anchor}"`);
      if (/^(click here|here|this page|read more|learn more)$/i.test(anchor)) problems.push(`${where} — non-descriptive anchor: "${anchor}"`);

      let p = href.replace(/^https?:\/\/floridabasketballjerseys\.com/, '').split('#')[0].split('?')[0];
      if (!p.startsWith('/')) continue;
      if (!p.endsWith('/')) p += '/';
      if (!known.has(p)) problems.push(`${where} — link to a page that does not exist: ${href}`);
    }
  }
}

console.log(`checked ${pages(SCOPE).length} pages under /${SCOPE}/: ${paras} paragraphs, ${links} internal links`);
if (problems.length === 0) {
  console.log('all internal-linking rules pass');
} else {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log('  ', p);
  process.exit(1);
}
