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
