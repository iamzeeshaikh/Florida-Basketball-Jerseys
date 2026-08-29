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
