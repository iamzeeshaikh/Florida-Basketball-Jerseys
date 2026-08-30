export const PROD_ORIGIN = 'https://floridabasketballjerseys.com';

// Absolute page URLs (canonicals, Open Graph, schema, internal links) are
// carried over from WordPress verbatim. A QA build (SITE_ORIGIN=http://host:port)
// repoints them at a local server so the copy can be crawled and screenshotted
// without touching the live site. Asset URLs are already root-relative.
export const ORIGIN = process.env.SITE_ORIGIN || PROD_ORIGIN;

export function rewrite(html) {
  if (ORIGIN === PROD_ORIGIN || !html) return html;
  return html.split(PROD_ORIGIN).join(ORIGIN)
             .split(PROD_ORIGIN.replace(/\//g, '\\/')).join(ORIGIN.replace(/\//g, '\\/'));
}

// ── Webfonts ─────────────────────────────────────────────────────────────────
// Every page on this site pulled Barlow Condensed and DM Sans through
// `@import url('https://fonts.googleapis.com/…')` written INSIDE an inline
// <style> block — the header carries one, the footer carries one, and product
// pages carried five more in their section CSS. An @import nested in a style
// element is the worst case for a webfont: the browser cannot even discover the
// request until it has downloaded and started parsing the stylesheet that
// contains it, and every one of them blocks rendering.
//
// The rules are removed here and the same two families are requested once from
// <head>, behind a preconnect, in Shell.astro. Same fonts, same weights,
// discovered immediately instead of two round-trips late.
const FONT_IMPORT = /@import\s+url\(\s*['"]?https:\/\/fonts\.googleapis\.com\/[^)]*\)\s*;?/g;

export const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;600&display=swap';

export function dropFontImports(html) {
  return html ? html.replace(FONT_IMPORT, '') : html;
}

/**
 * Remove Elementor's entrance-animation marker from the markup.
 *
 * On a product page, 126 elements across the catalogue carry
 * `elementor-invisible`, which holds them at visibility:hidden until
 * Elementor's script notices them entering the viewport and removes the class.
 *
 * For a visitor with working JavaScript that is invisible in both senses — the
 * content appears as they scroll to it and nothing is wrong. Without
 * JavaScript, or before it runs, the product gallery, the specification table,
 * the FAQs and the description are all permanently hidden while still
 * occupying nearly 8,000 pixels of layout. A visitor on a bad connection
 * reaches a product page with no photograph of the product and no description
 * of it.
 *
 * Content should not depend on an animation having run. The class is stripped
 * rather than overridden in CSS because Elementor keys its animation off it:
 * forced visible but still present, the script removes the class and runs the
 * fade anyway, whose first keyframe is opacity 0 — so the element blinks out
 * and back, which measures worse than leaving it alone. With the class absent
 * the script finds nothing to animate and does nothing.
 */
const ELEMENTOR_INVISIBLE = /\s*\belementor-invisible\b/g;

export function dropEntranceAnimations(html) {
  return html ? html.replace(ELEMENTOR_INVISIBLE, '') : html;
}

/**
 * Remove font and stylesheet requests the site does not need.
 *
 * Checked against the rendered page before removing anything, by walking every
 * element's computed style across six page types and comparing what the design
 * asks for against what the browser actually downloads.
 *
 *   Roboto and Roboto Slab -- Elementor requests both from Google with every
 *     weight and every italic, eighteen variants each. Neither family is set on
 *     any element anywhere on the site.
 *
 *   Source Sans Pro -- the Storefront theme's family, which IS used on a few
 *     theme-rendered elements. Not dropped but self-hosted, so the Google copy
 *     is a second download of fonts the page already has locally.
 */
const GOOGLE_FONT_LINKS =
  /<link[^>]+fonts\.googleapis\.com\/css\?family=(?:Roboto(?:\+Slab)?|Source\+Sans\+Pro):[^>]*>\s*/gi;

export function trimUnusedFonts(html) {
  return html ? html.replace(GOOGLE_FONT_LINKS, '') : html;
}

/**
 * WordPress's default "Uncategorized" term.
 *
 * It has no products, seventy words of page around an empty grid, and it was
 * being offered to search engines as indexable and listed in the sitemap. That
 * is a thin page competing with the seven real category pages for the same
 * crawl budget, and it exists only because WordPress creates it.
 *
 * Noindexed rather than removed, because the URL has been live and a 404 is a
 * worse answer than an honest "there is nothing here worth indexing".
 */
export function noindexEmptyCategory(head, route) {
  if (route !== '/product-category/uncategorized/') return head;
  return head.replace(
    /<meta name=(["'])robots\1 content=(["'])[^"']*\2\s*\/?>/i,
    "<meta name='robots' content='noindex, follow' />");
}

/* ── Head metadata the migration never carried over ──────────────────────────
 *
 * `<meta name="description">` existed on product pages and the home page only:
 * not on 7 category pages, 20 city pages or 13 blog posts. Yoast had written
 * an `og:description` for most of them, which is what a social card reads and
 * not what a search snippet does, so Google was writing its own snippet for
 * 58 of 104 indexable pages.
 *
 * `og:image` was worse than absent on products -- it was there and relative
 * (`/wp-content/uploads/...`). Open Graph requires an absolute URL, so every
 * product shared to a social network rendered as a bare text link. Everything
 * that is not a product had no image at all.
 *
 * And WooCommerce titles every archive "<Name> Archives - <Site>", a word
 * describing WordPress rather than the page.
 *
 * Nothing is invented: a page with no description source keeps none rather
 * than being given a generated one.
 */
export const DEFAULT_OG = '/og-default.jpg';

const HEAD_TITLE = /<title>([\s\S]*?)<\/title>/;
const OG_DESC = /<meta property="og:description" content="([^"]*)"/;
const OG_IMAGE = /(<meta property="og:image" content=")(\/[^"]*)(")/g;
const FIRST_UPLOAD = /<img\b[^>]*\bsrc="([^"]*\/wp-content\/uploads\/[^"]+\.(?:jpg|jpeg|png|webp))"/i;

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function ensureMeta(head, { description, image } = {}) {
  if (!head) return head;
  let out = head.replace(OG_IMAGE, (_, a, path, b) => a + ORIGIN + path + b);

  out = out.replace(/([^"><]) Archives( -| \||<)/g, '$1$2');

  const desc = description || (out.match(OG_DESC)?.[1] ?? null);
  const add = [];

  if (desc && !/<meta\s+name="description"/.test(out))
    add.push(`<meta name="description" content="${attr(desc)}" />`);
  if (desc && !OG_DESC.test(out))
    add.push(`<meta property="og:description" content="${attr(desc)}" />`);

  const img = image || ORIGIN + DEFAULT_OG;
  if (!/property="og:image"/.test(out))
    add.push(`<meta property="og:image" content="${attr(img)}" />`,
             `<meta name="twitter:image" content="${attr(img)}" />`);

  if (!add.length) return out;
  return HEAD_TITLE.test(out)
    ? out.replace(HEAD_TITLE, (m) => m + '\n' + add.join('\n'))
    : add.join('\n') + out;
}

/** The first content image on the page, absolutised -- what a share card shows. */
export function firstImage(bodyHtml) {
  let src = bodyHtml?.match(FIRST_UPLOAD)?.[1];
  if (!src) return null;
  // The markup usually points at a thumbnail rendition. A 324px square is
  // below the 600px floor most networks crop to, so the size suffix is
  // dropped -- WordPress keeps the original alongside every rendition.
  src = src.replace(/-\d{2,4}x\d{2,4}(\.(?:jpg|jpeg|png|webp))$/i, '$1');
  return src.startsWith('http') ? src : ORIGIN + (src.startsWith('/') ? src : '/' + src);
}

/* The brand archive lists exactly the same products as the shop page, under a
 * different URL and with no copy of its own; `uncategorized` is a WooCommerce
 * default that nothing should ever have been filed under. Both stay crawlable
 * so their product links still pass, and both stay out of the index.
 */
const DUPLICATE_ARCHIVE = /^\/(brand\/|product-category\/uncategorized\/)/;

export function noindexDuplicateArchive(head, route) {
  if (!head || !DUPLICATE_ARCHIVE.test(route) || /name="robots"/.test(head)) return head;
  return head.replace(/<title>/, '<meta name="robots" content="noindex,follow" />\n<title>');
}

/* Page two of a listing inherits page one's description, which would make two
 * URLs claim the same snippet. Naming the page keeps them distinguishable in
 * a search result without writing copy nobody reads.
 */
export function pageOf(description, route) {
  const n = route.match(/page\/(\d+)\/$/)?.[1];
  return description && n ? `${description} Page ${n}.` : description;
}

/* ── "From" on a starting price ──────────────────────────────────────────────
 *
 * WooCommerce renders the catalogue's unit price as a flat amount, so a custom
 * jersey read as "$4.00" in 236 places -- product pages, shop and category
 * listings, related products and pagination. It is a starting per-unit rate
 * rather than what a team pays, and an unqualified number reads as the
 * finished price to everyone who has not been told otherwise.
 *
 * The amount is left exactly as it is and labelled. Matching on the amount
 * span that follows means an already-labelled price cannot be labelled twice.
 */
const WOO_PRICE = /<span class="price">(?!\s*<span class="fbj-price-from")(\s*<span class="woocommerce-Price-amount)/g;

export function markPriceAsFrom(html) {
  if (!html) return html;
  return html.replace(WOO_PRICE, '<span class="price"><span class="fbj-price-from">From</span>$1');
}

/* The Product block comes from WordPress rather than from us, and it states
 * the same figure as a flat Offer.price -- an assertion that this is the
 * price, which the page no longer makes. AggregateOffer.lowPrice says "from"
 * in the markup the way the page says it in words, so the two agree.
 */
export function priceAsRange(head) {
  if (!head || !head.includes('"@type":"Offer"')) return head;
  return head.replace(
    /\{"@type":"Offer",([^{}]*?)"price":/g,
    '{"@type":"AggregateOffer",$1"lowPrice":',
  );
}
