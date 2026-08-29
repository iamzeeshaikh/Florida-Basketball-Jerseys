// Insert one internal link into a product description, by naming the exact
// phrase to wrap rather than a position.
//
// Positions move whenever the copy is edited; a phrase does not. The script
// refuses anything it cannot do unambiguously -- a phrase that appears twice,
// a phrase already inside an anchor, or a paragraph that already carries a
// link -- so a bad entry fails loudly instead of quietly linking the wrong
// sentence or stacking two links in one paragraph.
//
// Usage: node scripts/add-description-links.mjs <table.json>
//   [{ "slug": "...", "phrase": "exact text", "href": "/product/x/" }, ...]
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = 'src/data/product-description.json';
const table = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const data = JSON.parse(readFileSync(DATA, 'utf8'));

const strings = (v, path = []) => {
  // every editable string in a description, with the path to reach it
  const out = [];
  const walk = (node, p) => {
    if (typeof node === 'string') out.push({ p, s: node });
    else if (Array.isArray(node)) node.forEach((n, i) => walk(n, [...p, i]));
    else if (node && typeof node === 'object')
      for (const [k, n] of Object.entries(node)) if (k !== 'h2' && k !== 'h3') walk(n, [...p, k]);
  };
  walk(v, path);
  return out;
};
const setAt = (root, p, value) => {
  let n = root;
  for (const k of p.slice(0, -1)) n = n[k];
  n[p[p.length - 1]] = value;
};

let done = 0;
const fail = (m) => { console.error('  refused: ' + m); process.exitCode = 1; };

for (const { slug, phrase, href } of table) {
  const v = data[slug];
  if (!v) { fail(`${slug}: no such product`); continue; }
  const hits = strings(v).filter((x) => x.s.includes(phrase));
  if (hits.length === 0) { fail(`${slug}: phrase not found -- ${phrase}`); continue; }
  if (hits.length > 1) { fail(`${slug}: phrase appears ${hits.length}x -- ${phrase}`); continue; }
  const hit = hits[0];
  if (/<a\s/.test(hit.s)) { fail(`${slug}: that paragraph already has a link`); continue; }
  if (JSON.stringify(v).includes(`href=\\"${href}\\"`)) { fail(`${slug}: already links ${href}`); continue; }
  const words = phrase.trim().split(/\s+/).length;
  if (words < 3 || words > 8) { fail(`${slug}: anchor is ${words} words -- ${phrase}`); continue; }
  setAt(v, hit.p, hit.s.replace(phrase, `<a href="${href}">${phrase}</a>`));
  done++;
}

writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
console.log(`${done}/${table.length} links inserted`);
