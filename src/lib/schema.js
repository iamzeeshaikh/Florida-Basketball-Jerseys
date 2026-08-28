// Structured data built from what the page already says.
//
// ── The gap this closes ──────────────────────────────────────────────────────
// Every product page carries fifteen questions and answers in its FAQ tab —
// 629 across the catalogue — written for real customers and visible on the
// page. Not one of them was marked up. Two pages on the whole site had FAQPage
// schema, and neither was a product page.
//
// Nothing here invents content. Every question and answer is lifted from the
// rendered HTML, so the markup and the page can never disagree — which is both
// Google's requirement and the only way this stays correct as the copy changes.
//
// BreadcrumbList is generated from the route for the same reason: the trail is
// derivable, so it does not need to be written down twice and cannot drift.

import { PROD_ORIGIN } from './site.js';

const decode = (s) => String(s)
  .replace(/&#8217;|&#039;|&apos;/g, "'")
  .replace(/&#8220;|&#8221;|&quot;/g, '"')
  .replace(/&#8211;/g, '–')
  .replace(/&#8212;/g, '—')
  .replace(/&#36;/g, '$')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ');

const strip = (s) => decode(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/**
 * Pull question-and-answer pairs out of the rendered page.
 *
 * Scoped to the FAQ tab panel rather than run over the whole document: a
 * product page also carries `<h3>` headings inside the customization and
 * fabric sections, and some of those legitimately end in a question mark
 * ("Are These Shorts Right for You?"). Marking one of those up as an FAQ
 * answer would be describing the page inaccurately, which is the one thing
 * structured data must not do.
 */
export function extractFaqs(html) {
  const panel = html.match(/<div[^>]*id="tab-faqs_tab"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/div>)/);
  const scope = panel ? panel[1] : '';
  if (!scope) return [];

  const out = [];
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>\s*((?:<p[^>]*>[\s\S]*?<\/p>\s*)+)/g;
  let m;
  while ((m = re.exec(scope)) !== null) {
    const q = strip(m[1]);
    const a = strip(m[2]);
    if (q.length > 5 && a.length > 20) out.push({ q, a });
  }
  return out;
}

export function faqSchema(faqs) {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

/**
 * A breadcrumb trail from the route.
 *
 * WooCommerce route shapes are mapped to the labels a visitor actually sees:
 * /product/x/ sits under Shop, /product-category/x/ under Shop as well. A
 * segment with no sensible label is title-cased from its slug rather than
 * skipped, so the trail never has a hole in it.
 */
const SEGMENT_LABEL = {
  product: 'Shop',
  'product-category': 'Shop',
  brand: 'Brands',
};

const titleCase = (slug) => slug
  .split('-')
  .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
  .join(' ');

export function breadcrumbSchema(route, pageTitle) {
  if (!route || route === '/') return null;
  const parts = route.split('/').filter(Boolean);
  const items = [{ name: 'Home', item: `${PROD_ORIGIN}/` }];

  let acc = '';
  parts.forEach((seg, i) => {
    acc += `/${seg}`;
    const last = i === parts.length - 1;
    // Paginated listings are not a level of their own.
    if (seg === 'page' || /^\d+$/.test(seg)) return;
    const label = last && pageTitle ? pageTitle : (SEGMENT_LABEL[seg] || titleCase(seg));
    items.push({ name: label, item: `${PROD_ORIGIN}${acc}/` });
  });

  if (items.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.item,
    })),
  };
}

/** The <h1> is the most reliable name for the page we are on. */
export function pageTitleFrom(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? strip(m[1]) : '';
}

/** One <script> block per schema object, ready to append to the body. */
export function schemaTags(objects) {
  return objects
    .filter(Boolean)
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`)
    .join('\n');
}
