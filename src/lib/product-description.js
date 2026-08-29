// A Description tab on every product page.
//
// The migrated product template ships two tabs — Specifications and Faqs — and
// no prose. The specification table is a grid of two-word cells and the FAQs
// answer questions a visitor already has; neither explains the product to
// somebody who has not decided yet. This is that missing tab, and it is the
// first one, because it is what a reader wants before a spec sheet.
//
// The content is authored per product in src/data/product-description.json and
// rendered here, rather than written as HTML in the data file, so the markup
// is consistent and the writing stays writing. Each product supplies its own
// headings; there is no shared skeleton, because a template would produce 23
// pages that differ only in nouns.
//
// Formatting is deliberately mixed and deliberately bounded: exactly one
// bulleted list and exactly one numbered list per description, short
// paragraphs, short sentences. A wall of prose and a page of nothing but
// bullets are both worse than the two used where each earns its place. The
// build asserts both counts.

import content from '../data/product-description.json';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── The block kinds a description may use ───────────────────────────────── */

const BLOCKS = {
  // Ordinary prose. Each paragraph is its own element so the one-link-per-
  // paragraph rule is enforceable by reading the markup.
  p: (b) => b.text.map((t) => `<p>${t}</p>`).join('\n'),

  // The single bulleted list. Used where the content is genuinely a set of
  // parallel items with no order between them.
  bullets: (b) => `<ul class="fbj-pd__bullets">
${b.items.map((t) => `        <li>${t}</li>`).join('\n')}
      </ul>`,

  // The single numbered list. Used only where the order is the point — a
  // sequence, a decision path, steps that happen one after another.
  steps: (b) => `<ol class="fbj-pd__steps">
${b.items.map((t) => `        <li>${t}</li>`).join('\n')}
      </ol>`,

  // A short two-column comparison, for the products whose choice is a trade.
  table: (b) => `<div class="fbj-tablescroll">
        <table class="fbj-pd__table">
          <thead><tr>${b.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>
${b.rows.map((r) => `            <tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}
          </tbody>
        </table>
      </div>`,

  // A pulled-out sentence. One per description at most; it is emphasis, and
  // emphasis stops working when it is everywhere.
  note: (b) => `<p class="fbj-pd__note">${b.text}</p>`,
};

function section(s) {
  const body = s.blocks.map((b) => {
    const render = BLOCKS[b.kind];
    return render ? `      ${render(b)}` : '';
  }).filter(Boolean).join('\n');
  return `    <h3 class="fbj-pd__h3">${esc(s.h3)}</h3>
${body}`;
}

function render(c) {
  return `<div class="fbj-pd">
    <h2 class="fbj-pd__h2">${esc(c.h2)}</h2>
    <p class="fbj-pd__lede">${c.lede}</p>
${c.sections.map(section).join('\n')}
  </div>`;
}

/* ── Splicing it into the WooCommerce tab set ────────────────────────────── */

const TAB_LIST = '<ul class="tabs wc-tabs" role="tablist">';
const FIRST_PANEL = '<div class="woocommerce-Tabs-panel';

const TAB_LI = `
<li role="presentation" class="description_tab_tab" id="tab-title-description_tab">
<a href="#tab-description_tab" role="tab" aria-controls="tab-description_tab">Description</a>
</li>`;

/**
 * Add the tab and its panel.
 *
 * The tab goes first in the list and its panel first among the panels, because
 * WooCommerce's own script shows the first tab on load and hides the rest —
 * so position is what makes this the default view rather than any extra class.
 * Nothing here touches the existing tabs: the FAQ extraction that builds the
 * page's FAQPage markup keys on `id="tab-faqs_tab"`, and that panel is
 * untouched and still where it was.
 */
export function addDescriptionTab(html, slug) {
  const c = content[slug];
  if (!c) return html;

  const listAt = html.indexOf(TAB_LIST);
  if (listAt < 0) return html;
  let out = html.slice(0, listAt + TAB_LIST.length) + TAB_LI + html.slice(listAt + TAB_LIST.length);

  const panelAt = out.indexOf(FIRST_PANEL);
  if (panelAt < 0) return html;
  const panel = `<div class="woocommerce-Tabs-panel woocommerce-Tabs-panel--description_tab panel entry-content wc-tab" id="tab-description_tab" role="tabpanel" aria-labelledby="tab-title-description_tab">
  ${render(c)}
</div>
`;
  return out.slice(0, panelAt) + panel + out.slice(panelAt);
}

export function hasDescription(slug) {
  return Object.prototype.hasOwnProperty.call(content, slug);
}

/** For the build assertions: the description as plain text. */
export function descriptionText(slug) {
  const c = content[slug];
  if (!c) return '';
  return JSON.stringify(c).replace(/<[^>]+>/g, ' ').replace(/[{}\[\]",:]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
