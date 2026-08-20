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
