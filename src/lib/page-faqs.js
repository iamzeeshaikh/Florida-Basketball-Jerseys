// Questions on the pages that were carrying none.
//
// Every product, category, location and article page answers questions; the
// rest of the site did not. Six of those pages are ones where a visitor
// arrives with a specific question in mind — how ordering works, how long a
// quote takes, which measurement decides a size, what happens if a jersey is
// wrong — and answering it on the page is worth more than the markup is.
//
// The flow pages are deliberately excluded. A cart, a checkout, an account
// page, a thank-you page and a sitemap are steps in a process rather than
// places that answer anything, and marking one of them up as an FAQPage would
// be describing content that is not there. Legal pages are excluded for the
// same reason: a returns policy already states its terms in full, and turning
// half of it into questions to earn a schema type would make it worse.

import faqs from '../data/page-faqs.json';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render(c) {
  return `
<section class="fbj-pfaq" aria-labelledby="fbj-pfaq-title">
  <div class="fbj-pfaq__inner">
    <div class="fbj-pfaq__eyebrow">${esc(c.eyebrow)}</div>
    <h2 class="fbj-pfaq__h2" id="fbj-pfaq-title">${esc(c.h2)}</h2>
    ${c.sub ? `<p class="fbj-pfaq__sub">${c.sub}</p>` : ''}
    <div class="fbj-pfaq__list">
      ${c.faqs.map((f) => `<details class="fbj-pfaq__item">
        <summary><h3>${esc(f.q)}</h3></summary>
        <div class="fbj-pfaq__a"><p>${f.a}</p></div>
      </details>`).join('\n      ')}
    </div>
  </div>
</section>`;
}

/** Placed at the end of <main> where there is one, otherwise appended. */
export function addPageFaqs(html, route) {
  const c = faqs[route];
  if (!c) return html;
  const close = html.lastIndexOf('</main>');
  return close >= 0
    ? html.slice(0, close) + render(c) + html.slice(close)
    : html + render(c);
}

export function hasPageFaqs(route) {
  return Object.prototype.hasOwnProperty.call(faqs, route);
}

/** The pairs as data, for the FAQPage block. */
export function pageFaqs(route) {
  const c = faqs[route];
  if (!c) return [];
  return c.faqs.map((f) => ({
    q: f.q,
    a: String(f.a).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));
}
