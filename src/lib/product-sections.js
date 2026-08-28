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
import {
  renderAudience, renderCustomization, renderFabricButtons, renderFabricPanels,
  renderSizeTabs, renderMeasure, renderConstruction, renderCare, sizeTabIds,
} from './product-render.js';

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

/**
 * Replace the inner HTML of one element, matched by class.
 *
 * The close tag is found by COUNTING, not by regex. A lazy `[\s\S]*?</div>`
 * stops at the first close tag it meets, which for any container holding
 * nested elements is one of the children — so replacing the inner HTML of a
 * card grid left every original card in place and merely inserted the new ones
 * above them. That showed up as nine audience cards on a page meant to have
 * four, and fourteen fabric buttons on a page meant to have three.
 */
function replaceInner(html, cls, tag, inner) {
  const open = new RegExp(`<${tag}\\b[^>]*class="${cls}"[^>]*>`);
  const m = open.exec(html);
  if (!m) return html;

  const start = m.index + m[0].length;
  const step = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  step.lastIndex = start;
  let depth = 1;
  let hit;
  while ((hit = step.exec(html)) !== null) {
    depth += hit[1] ? -1 : 1;
    if (depth === 0) {
      return html.slice(0, start) + inner + html.slice(hit.index);
    }
  }
  return html;                       // unbalanced markup: leave it alone
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
  // grey -> gray is deliberately NOT here. "Grey Basketball Jersey" is a
  // product's actual name, its slug, and 356 strings across the site; changing
  // the spelling would rename the product. That is a decision for whoever owns
  // the catalogue, not a side effect of a spelling pass.
];

/**
 * Apply the spellings to TEXT ONLY — never inside a tag.
 *
 * The first version ran over the raw HTML, and `\b` treats a hyphen as a word
 * boundary, so `/product/grey-basketball-jersey/` matched and would have been
 * rewritten to `gray-basketball-jersey` — a 404 on every link to it, in every
 * related-products grid on the site. It survived only because none of the five
 * pages rewritten so far happens to link there; adding content for the grey
 * jersey would have shipped it.
 *
 * Splitting on tags and transforming only the gaps means an href, a class, a
 * data attribute, or an inline script can never be touched by a change to
 * prose. Anything inside <script> or <style> is skipped for the same reason.
 */
export function americanize(html) {
  if (!html) return html;
  let skipDepth = 0;
  return html.split(/(<[^>]*>)/).map((chunk) => {
    if (chunk.startsWith('<')) {
      if (/^<\s*(script|style)\b/i.test(chunk)) skipDepth++;
      else if (/^<\s*\/\s*(script|style)\b/i.test(chunk)) skipDepth = Math.max(0, skipDepth - 1);
      // Four attributes hold prose a person actually reads — a screen reader
      // announces aria-label and alt, and title and placeholder are shown. They
      // are corrected; every other attribute, href and class and data-* among
      // them, is left exactly as it is.
      return chunk.replace(
        /\b(alt|aria-label|title|placeholder)="([^"]*)"/gi,
        (m, attr, val) => {
          let out = val;
          for (const [re, fn] of SPELLING) out = out.replace(re, fn);
          return `${attr}="${out}"`;
        },
      );
    }
    if (skipDepth > 0) return chunk;      // inside <script> or <style>
    let out = chunk;
    for (const [re, fn] of SPELLING) out = out.replace(re, fn);
    return out;
  }).join('');
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

  // ── the bodies, not just the headings ──────────────────────────────────────
  // Filling only the marked slots left 2,850 identical words on every page
  // against 782 that were about the product. These four blocks are where that
  // sat, so they are generated per product too.
  if (c.audience) h = replaceInner(h, 'fbj-pwb-grid', 'div', renderAudience(c.audience));
  if (c.customization) h = replaceInner(h, 'fbj-pco-grid', 'div', renderCustomization(c.customization));
  if (c.fabrics) {
    h = replaceInner(h, 'fbj-pfb-selector', 'div',
      `<div class="fbj-pfb-selector-head">Select Fabric Type</div>${renderFabricButtons(c.fabrics.list, c.fabrics.recommended)}`);
    h = replaceInner(h, 'fbj-pfb-detail', 'div',
      renderFabricPanels(c.fabrics.list, c.fabrics.recommended, c.fabrics.notes || {}));
  }

  if (c.construction) h = replaceInner(h, 'fbj-pfb-construction', 'div', renderConstruction(c.construction));
  if (c.care) h = replaceInner(h, 'fbj-pfb-care-grid', 'div', renderCare(c.care));
  if (c.floridaNote) h = replaceInner(h, 'fbj-pfb-florida-text', 'p', c.floridaNote);

  if (c.sizing) {
    if (c.sizing.tabs) {
      h = replaceInner(h, 'fbj-psg-tabs', 'div', renderSizeTabs(c.sizing.tabs));
      // Drop the tables the product does not use. A pair of shorts carried an
      // adult jersey chest chart and a youth jersey chart it had no use for —
      // 476 words identical on all 42 pages, two thirds of them irrelevant to
      // whichever page you were on.
      const keep = new Set(c.sizing.tabs.map((k) => `fbj-psg-${k}`));
      for (const id of sizeTabIds()) if (!keep.has(id)) h = removeElementById(h, id);
    }
    if (c.sizing.measure) h = replaceInner(h, 'fbj-psg-measure', 'div', renderMeasure(c.sizing.measure));
  }

  return h;
}

/** Remove one element and everything inside it, matched by id. */
function removeElementById(html, id) {
  const open = new RegExp(`<(\\w+)\\b[^>]*id="${id}"[^>]*>`);
  const m = open.exec(html);
  if (!m) return html;
  const tag = m[1];
  const step = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  step.lastIndex = m.index + m[0].length;
  let depth = 1;
  let hit;
  while ((hit = step.exec(html)) !== null) {
    depth += hit[1] ? -1 : 1;
    if (depth === 0) return html.slice(0, m.index) + html.slice(hit.index + hit[0].length);
  }
  return html;
}

/**
 * Reorder — and drop — whole sections, per product.
 *
 * Unique words are not enough on their own: five sections in the same order on
 * all 42 pages still reads as one template wearing different copy. A product
 * declares which sections it carries and in what sequence, so a pair of shorts
 * leads with sizing where a colored jersey leads with what can be customized,
 * and a blank jersey drops the customization section altogether because there
 * is nothing on it to customize.
 *
 * Anything a product does not list is left out. Anything it lists that is not
 * in the page is skipped rather than faked.
 */
const SECTION_ORDER_DEFAULT = ['pov', 'pco', 'pfb', 'psg', 'pwb'];

export function arrangeSections(block, wanted) {
  const order = wanted && wanted.length ? wanted : SECTION_ORDER_DEFAULT;
  const marks = SECTION_ORDER_DEFAULT
    .map((k) => ({ k, i: block.indexOf(`<section class="fbj-${k}-wrap"`) }))
    .filter((m) => m.i >= 0)
    .sort((a, b) => a.i - b.i);
  if (marks.length === 0) return block;

  const head = block.slice(0, marks[0].i);
  const parts = {};
  marks.forEach((m, n) => {
    parts[m.k] = block.slice(m.i, n + 1 < marks.length ? marks[n + 1].i : block.length);
  });

  return head + order.map((k) => parts[k] || '').join('');
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
/**
 * The corrections every page gets, product or not.
 *
 * Kept separate from the section fill because they are not about products: the
 * dead link and the British spellings are on pages that have no sections to
 * fill, and scoping them to "products we have written copy for" left 117 of
 * them shipping on the pages that had not been reached yet.
 */
export function polishPage(html) {
  return americanize(fixDeadLinks(stripAuthoringComments(html)));
}

export function applyProductContent(html, slug) {
  const c = content[slug];
  const s = blockStart(html);
  const e = blockEnd(html);
  if (!c || s < 0 || e < 0 || e <= s) return polishPage(html);

  let block = html.slice(s, e);
  block = stripSectionStyles(block);
  block = fillBlock(block, c);
  block = arrangeSections(block, c.sections);

  return polishPage(html.slice(0, s) + block + html.slice(e));
}

export function hasProductContent(slug) {
  return Object.prototype.hasOwnProperty.call(content, slug);
}
