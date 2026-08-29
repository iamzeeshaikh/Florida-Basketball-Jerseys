// Content for the 22 product-category pages.
//
// As migrated, every category page was a WooCommerce shell: an <h1>, two
// sorting widgets and a product grid, with 137 to 204 words of page around it. That is a page which duplicates its
// own single product page while telling a reader nothing, and there are 22 of
// them.
//
// A category page has a job the product page cannot do: the product page
// answers "what is this jersey", the category page answers "is this the kind
// of jersey I should be ordering, and what changes if I pick a different
// kind". That is what these pages now carry — comparisons against the
// neighboring categories, the constraints that actually bind (league rules,
// budgets, roster turnover, laundry), and the questions a coach or an athletic
// director asks before they commit a season's order.
//
// Six layouts, so the section is not the same shape seven times, and each
// category states which one fits its content rather than being assigned one by
// rotation: a category whose decision is genuinely binary gets the two-column
// split, one with graded options gets the ladder, one whose answer is a
// sequence gets the numbered walkthrough.

import content from '../data/category-content.json';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── The six layouts ─────────────────────────────────────────────────────── */

// A graded run of options, cheapest/lightest first. For categories where the
// choice is "how far up this scale do you need to go".
const ladder = (b) => `
    <div class="fbj-cat__ladder">
      ${b.rows.map((r, i) => `<div class="fbj-cat__rung">
        <div class="fbj-cat__rung-mark" aria-hidden="true">${String(i + 1).padStart(2, '0')}</div>
        <div class="fbj-cat__rung-body">
          <h3 class="fbj-cat__rung-h">${esc(r.h)}</h3>
          <p>${r.p}</p>
        </div>
        ${r.tag ? `<div class="fbj-cat__rung-tag">${esc(r.tag)}</div>` : ''}
      </div>`).join('\n      ')}
    </div>`;

// Two columns, "pick this / pick that". For a genuinely binary decision.
const split = (b) => `
    <div class="fbj-cat__split">
      ${b.sides.map((s, i) => `<div class="fbj-cat__side${i === 0 ? ' fbj-cat__side--lead' : ''}">
        <div class="fbj-cat__side-cap">${esc(s.cap)}</div>
        <h3 class="fbj-cat__side-h">${esc(s.h)}</h3>
        <ul class="fbj-cat__side-list">
          ${s.items.map((t) => `<li>${t}</li>`).join('\n          ')}
        </ul>
      </div>`).join('\n      ')}
    </div>`;

// A sequence. For categories whose answer is an order of operations.
const walkthrough = (b) => `
    <ol class="fbj-cat__walk">
      ${b.steps.map((s) => `<li class="fbj-cat__step">
        <h3 class="fbj-cat__step-h">${esc(s.h)}</h3>
        <p>${s.p}</p>
      </li>`).join('\n      ')}
    </ol>`;

// A real comparison table, for categories that sit against a named alternative.
const table = (b) => `
    <div class="fbj-cat__tablewrap">
      <table class="fbj-cat__table">
        <caption>${esc(b.caption)}</caption>
        <thead><tr><th scope="col">${b.cols.map(esc).join('</th><th scope="col">')}</th></tr></thead>
        <tbody>
          ${b.rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n          ')}
        </tbody>
      </table>
    </div>`;

// Question-led subheadings with prose under each. For categories where the
// buyer arrives with specific worries rather than a spec to match.
const questions = (b) => `
    <div class="fbj-cat__qs">
      ${b.items.map((q) => `<div class="fbj-cat__q">
        <h3 class="fbj-cat__q-h">${esc(q.h)}</h3>
        ${q.p.map((p) => `<p>${p}</p>`).join('\n        ')}
      </div>`).join('\n      ')}
    </div>`;

// A checklist grid plus a pulled-out caution. For categories where the
// failure mode is forgetting something at order time.
const checklist = (b) => `
    <div class="fbj-cat__check">
      <ul class="fbj-cat__check-list">
        ${b.items.map((t) => `<li>${t}</li>`).join('\n        ')}
      </ul>
      <aside class="fbj-cat__callout">
        <div class="fbj-cat__callout-cap">${esc(b.callout.cap)}</div>
        <p>${b.callout.p}</p>
      </aside>
    </div>`;

const LAYOUTS = { ladder, split, walkthrough, table, questions, checklist };

/* ── The main section ────────────────────────────────────────────────────── */

/**
 * A category may carry more than one block, because one layout is rarely
 * enough to cover both what the category is and how to choose within it.
 * `block` stays supported for a category that only needs one.
 */
function renderBlock(b) {
  const build = LAYOUTS[b.layout];
  return `
    ${b.h3 ? `<h3 class="fbj-cat__block-h">${esc(b.h3)}</h3>` : ''}
    ${b.lead ? `<p class="fbj-cat__sub">${b.lead}</p>` : ''}
    ${build ? build(b) : ''}
    ${b.close ? `<div class="fbj-cat__close"><p>${b.close}</p></div>` : ''}`;
}

function section(c) {
  const blocks = c.blocks || (c.block ? [c.block] : []);
  return `
<section class="fbj-cat fbj-cat--${esc(blocks[0]?.layout || 'prose')}" aria-labelledby="fbj-cat-title">
  <div class="fbj-cat__inner">
    <div class="fbj-cat__eyebrow">${esc(c.eyebrow)}</div>
    <h2 class="fbj-cat__h2" id="fbj-cat-title">${esc(c.h2)}</h2>
    <div class="fbj-cat__intro">
      ${c.intro.map((p) => `<p>${p}</p>`).join('\n      ')}
    </div>
    ${blocks.map(renderBlock).join('\n')}
    ${c.close ? `<div class="fbj-cat__close"><p>${c.close}</p></div>` : ''}
  </div>
</section>`;
}

function faqBlock(c) {
  return `
<section class="fbj-cat-faq" aria-labelledby="fbj-cat-faq-title">
  <div class="fbj-cat-faq__inner">
    <h2 class="fbj-cat-faq__h2" id="fbj-cat-faq-title">${esc(c.faqH2)}</h2>
    <div class="fbj-cat-faq__list">
      ${c.faqs.map((f) => `<details class="fbj-cat-faq__item">
        <summary><h3>${esc(f.q)}</h3></summary>
        <div class="fbj-cat-faq__a"><p>${f.a}</p></div>
      </details>`).join('\n      ')}
    </div>
  </div>
</section>`;
}

/* ── Placement ───────────────────────────────────────────────────────────── */

const HEADER_END = '</header>';

/**
 * The form goes directly under the <h1>, before the sorting widget and the
 * grid; the prose and the FAQs go after the grid, so the products a visitor
 * came for are still the first thing below the fold.
 */
export function addCategoryContent(html, slug) {
  const c = content[slug];
  if (!c) return html;
  // The quote form is already at the top of every category page, rendered by
  // QuickQuote.astro — so this adds prose and questions only, after the product
  // grid and still inside <main>.
  const close = html.lastIndexOf('</main>');
  const body = section(c) + faqBlock(c);
  return close >= 0 ? html.slice(0, close) + body + html.slice(close) : html + body;
}

export function hasCategoryContent(slug) {
  return Object.prototype.hasOwnProperty.call(content, slug);
}

/** The FAQ pairs as data, for FAQPage markup. */
export function categoryFaqs(slug) {
  const c = content[slug];
  if (!c) return [];
  return c.faqs.map((f) => ({
    q: f.q,
    a: String(f.a).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));
}

export function isCategoryRoute(route) {
  return /^\/product-category\/[^/]+\/$/.test(route);
}

export function categorySlug(route) {
  return route.replace('/product-category/', '').replace(/\/$/, '');
}
