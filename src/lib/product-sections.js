// Make the five product-page sections say something about THIS product.
//
// ── What was wrong ───────────────────────────────────────────────────────────
// The migrated product pages each carry a five-section block — overview,
// customization, fabric, size guide, who-it-is-for — that runs from the end of
// the WooCommerce summary to the related-products grid. It is 180,715 bytes, or
// 79% of the page, and it was byte-for-byte IDENTICAL on all 42 products: 39 of
// them exactly, the other three differing only where the product name appears.
// Two product pages therefore read 86.6% the same.
//
// It was never meant to ship that way. Whoever built it left 25 authoring notes
// per page in the HTML — `<!-- CHANGE THIS: H2 per product -->`, `<!-- CHANGE
// THIS: prose description per product -->` — and those 1,050 comments are still
// being served to browsers and crawlers. The slots were designed; nobody filled
// them. So a page about mesh SHORTS is headed "What Is a Sublimated Basketball
// Jersey?", offers a "Jersey Size Guide", and asks "Who This Jersey Is Best For".
//
// ── What this does ───────────────────────────────────────────────────────────
// Fills exactly those slots, per product, from src/data/product-content.json.
// It deliberately does NOT rebuild the markup: the size guide carries tabs and
// an in/cm toggle wired to inline handlers, and the visual cards carry inline
// SVG. Structure and behaviour stay byte-identical; only the words change. That
// keeps a content change from becoming a layout regression.
//
// It also, on every product page:
//   • strips the 1,050 authoring comments
//   • lifts the five inline <style> blocks out (56,851 bytes per page, carrying
//     FIVE copies of the same Google Fonts @import) — they now load once from
//     /assets/product-sections.css
//   • repairs the alternatives link, which pointed at
//     /product/practice-basketball-jerseys/ — a 404. The real slug is
//     basketball-practice-jerseys, so that was 42 broken links, one per product.
//   • corrects British spellings on a US site (customise, fibre, colour…)

import content from '../data/product-content.json';

/** Start of the block: the <style> that opens just before the first section. */
export function blockStart(html) {
  const first = html.indexOf('fbj-pov-wrap');
  if (first < 0) return -1;
  return html.lastIndexOf('<style', first);
}

/** End of the block: the wrapper that holds the related-products grid. */
export function blockEnd(html) {
  const rp = html.indexOf('Related products');
  if (rp < 0) return -1;
  return html.lastIndexOf('<div class="elementor-element', rp);
}

// ── slot helpers ─────────────────────────────────────────────────────────────
// Each one replaces the INNER HTML of a single element, matched by its class.
// Anchored on the class rather than on surrounding text so that filling one
// slot can never disturb its neighbours.

function replaceInner(html, cls, tag, inner) {
  const open = new RegExp(`(<${tag}\\b[^>]*class="${cls}"[^>]*>)([\\s\\S]*?)(</${tag}>)`);
  return html.replace(open, (m, a, _b, c) => `${a}${inner}${c}`);
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CHECK_SVG = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BENEFIT_SVG = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ── British → US, on a site selling to Florida ───────────────────────────────
// Word-boundary anchored and case-preserving for the leading letter, so
// "Customisation" and "customisation" both land correctly and "customised" is
// not turned into "customizeed".
const SPELLING = [
  [/\b(C|c)ustomis(e|ed|es|ing|ation|able)\b/g, (m, c, s) => `${c}ustomiz${s}`],
  [/\b(F|f)ibre(s?)\b/g, (m, c, s) => `${c}iber${s}`],
  [/\b(C|c)olour(s|ed|ing|ful)?\b/g, (m, c, s) => `${c}olor${s || ''}`],
  [/\b(P|p)ersonalis(e|ed|es|ing|ation)\b/g, (m, c, s) => `${c}ersonaliz${s}`],
  [/\b(O|o)rganis(e|ed|es|ing|ation)\b/g, (m, c, s) => `${c}rganiz${s}`],
  [/\b(S|s)pecialis(e|ed|es|ing|t|ts)\b/g, (m, c, s) => `${c}pecializ${s}`],
  [/\b(C|c)entre(s?)\b/g, (m, c, s) => `${c}enter${s}`],
  [/\b(P|p)ractise\b/g, (m, c) => `${c}ractice`],
  [/\b(G|g)rey\b/g, (m, c) => `${c}ray`],
];

export function americanize(html) {
  let out = html;
  for (const [re, fn] of SPELLING) out = out.replace(re, fn);
  return out;
}

/** Fill every per-product slot in the block. */
export function fillBlock(block, c) {
  let h = block;

  // ── overview ──────────────────────────────────────────────────────────────
  h = replaceInner(h, 'fbj-pov-eyebrow', 'div',
    `<span class="fbj-pov-eyebrow-dot"></span>\n        ${esc(c.eyebrow)}`);

  h = replaceInner(h, 'fbj-pov-h2', 'h2',
    `${esc(c.h2.pre)}<br><span>${esc(c.h2.em)}</span><br>${esc(c.h2.post)}`);

  h = replaceInner(h, 'fbj-pov-h2-sub', 'div', esc(c.sub));

  h = replaceInner(h, 'fbj-pov-prose', 'div',
    c.prose.map((p) => `<p>${p}</p>`).join('\n        '));

  h = replaceInner(h, 'fbj-pov-tags', 'div',
    c.bestFor.map((t) => `<span class="fbj-pov-tag">${CHECK_SVG}${esc(t)}</span>`).join('\n          '));

  h = replaceInner(h, 'fbj-pov-benefits', 'div',
    c.benefits.map((b) => `<div class="fbj-pov-benefit">` +
      `<div class="fbj-pov-benefit-icon" aria-hidden="true">${BENEFIT_SVG}</div>` +
      `<div class="fbj-pov-benefit-text"><strong>${b.strong}</strong> ${b.rest}</div>` +
      `</div>`).join('\n        '));

  h = replaceInner(h, 'fbj-pov-visual-label', 'div', esc(c.visualLabel));
  h = replaceInner(h, 'fbj-pov-card-name', 'div', esc(c.cardName));
  h = replaceInner(h, 'fbj-pov-card-sub', 'div', esc(c.cardSub));

  // Production time: "7–<span>14</span>" business days.
  h = replaceInner(h, 'fbj-pov-qi-val', 'div',
    `${esc(c.production.from)}–<span>${esc(c.production.to)}</span>`);

  // ── customization / fabric / size guide / who-it-is-for intros ────────────
  h = replaceInner(h, 'fbj-pco-header-sub', 'p', c.customizationIntro);
  h = replaceInner(h, 'fbj-pfb-header-sub', 'p', c.fabricIntro);
  h = replaceInner(h, 'fbj-psg-header-sub', 'p', c.sizingIntro);
  h = replaceInner(h, 'fbj-pwb-header-sub', 'p', c.bestForIntro);
  h = replaceInner(h, 'fbj-pwb-notfit-intro', 'div', `<p>${c.notFitIntro}</p>`);

  // Section headings that named the wrong garment on shorts, shirts and
  // tank-top pages ("Jersey Size Guide", "Who This Jersey Is Best For").
  h = replaceInner(h, 'fbj-pco-h2', 'h2', `Full Customization<br><span>Options</span>`);
  h = replaceInner(h, 'fbj-pco-eyebrow', 'div', `What You Can Customize`);
  // Half the catalogue is a plural noun — Shorts, Tank Tops, Uniforms — so the
  // headings have to agree with it. Writing them around a singular "Jersey" is
  // how the original ended up with "Who This Jersey Is Best For" sitting on a
  // page about shorts; keeping the singular phrasing and only swapping the noun
  // would have replaced it with "Who This Shorts Is Best For", which is no
  // better. The verb and determiner move with the noun.
  const n = esc(c.noun);
  const isPlural = c.plural === true;
  const [det, verb, verbBe] = isPlural ? ['These', 'Are', 'Are'] : ['This', 'Is', 'Is'];

  h = replaceInner(h, 'fbj-pfb-eyebrow', 'div', `What Your ${n} ${verbBe} Made Of`);
  h = replaceInner(h, 'fbj-psg-h2', 'h2', `${n}<br><span>Size Guide</span>`);
  h = replaceInner(h, 'fbj-psg-eyebrow', 'div', `Sizing Reference`);
  h = replaceInner(h, 'fbj-pwb-h2', 'h2', `Who ${det} ${n} ${verb}<br><span>Best For</span>`);
  h = replaceInner(h, 'fbj-pwb-eyebrow', 'div', `${verbBe} ${det.toLowerCase() === 'these' ? 'These' : 'This'} ${n} Right for You?`);

  return h;
}

/**
 * Strip the authoring notes that were never meant to ship.
 *
 * They come in three shapes, and the first pass only caught one: the inline
 * `<!-- CHANGE THIS: … -->` markers, the `<!-- e.g. "…" -->` examples beside
 * them, and multi-line `<!-- TEMPLATE VARIABLES — change per product: … -->`
 * headers that list what an author was supposed to edit. Matching on the
 * PHRASES rather than on one exact prefix is what makes this complete —
 * checking for the prefix alone left seven of the twenty-five behind.
 */
export function stripAuthoringComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, (c) =>
    /CHANGE THIS|TEMPLATE VARIABLES|^<!--\s*e\.g\./i.test(c) ? '' : c);
}

/** Lift the five inline <style> blocks; they are served from one file now. */
export function stripSectionStyles(html) {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, (m) =>
    /fbj-(pov|pco|pfb|psg|pwb)-/.test(m) ? '' : m);
}

/** The alternatives link pointed at a slug that has never existed. */
export function fixDeadLinks(html) {
  return html.replace(
    /\/product\/practice-basketball-jerseys\//g,
    '/product/basketball-practice-jerseys/',
  );
}

/**
 * Rewrite one product page's HTML. Returns it unchanged for any page without
 * the block, so non-product routes pass through untouched.
 */
export function applyProductContent(html, slug) {
  const c = content[slug];
  const s = blockStart(html);
  const e = blockEnd(html);
  if (!c || s < 0 || e < 0 || e <= s) return html;

  let block = html.slice(s, e);
  block = stripSectionStyles(block);
  block = fillBlock(block, c);

  // Comments are stripped from the WHOLE page, not just the block. One of the
  // twenty-five sits above it, in the WooCommerce summary, and scoping the
  // strip to the block left it shipping on its own.
  const out = stripAuthoringComments(html.slice(0, s) + block + html.slice(e));
  return americanize(fixDeadLinks(out));
}

export function hasProductContent(slug) {
  return Object.prototype.hasOwnProperty.call(content, slug);
}
