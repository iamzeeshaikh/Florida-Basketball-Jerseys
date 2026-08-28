// Build a page record for a route WordPress never had.
//
// Shell.astro renders the captured <head>, body class, header and footer, and
// that head is 31KB of theme and Elementor stylesheet links. A page written
// from scratch still needs every one of them or the shared header and footer
// render unstyled — so rather than hand-maintaining a second copy that will
// drift the first time a stylesheet is added, a new page BORROWS a real
// page's head and only the parts that identify the page are replaced.
//
// The donor is /about/: a plain content page with no product, cart or
// pagination markup in its head.

import pages from '../data/pages.json';
import { PROD_ORIGIN } from './site.js';

const DONOR_ROUTE = '/about/';

const donor = Object.values(pages).find((p) => p.route === DONOR_ROUTE);

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Replace one meta tag's content attribute, or drop the tag if it has no
 * meaningful equivalent on the new page. Anything not named here — every
 * stylesheet, preload and script — is carried over untouched.
 */
function setMeta(head, matcher, value) {
  return head.replace(matcher, (tag) =>
    tag.replace(/content=(["'])[\s\S]*?\1/, `content="${esc(value)}"`));
}

export function makePage({ route, title, description, ogType = 'article', styles = [] }) {
  if (!donor) throw new Error(`newpage: donor route ${DONOR_ROUTE} is missing from pages.json`);
  const url = `${PROD_ORIGIN}${route}`;
  let head = donor.head;

  head = head.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  head = head.replace(/(<link[^>]*rel=["']canonical["'][^>]*href=["'])[^"']*/i, `$1${url}`);
  head = setMeta(head, /<meta[^>]*\bname=["']description["'][^>]*>/i, description);
  head = setMeta(head, /<meta[^>]*property=["']og:title["'][^>]*>/i, title);
  head = setMeta(head, /<meta[^>]*property=["']og:description["'][^>]*>/i, description);
  head = setMeta(head, /<meta[^>]*property=["']og:url["'][^>]*>/i, url);
  head = setMeta(head, /<meta[^>]*property=["']og:type["'][^>]*>/i, ogType);

  // The donor's reading-time card and article timestamps describe the donor.
  // Wrong data is worse than no data, so they are removed rather than guessed.
  head = head.replace(/<meta[^>]*name=["']twitter:(label|data)\d["'][^>]*>\s*/gi, '');
  head = head.replace(/<meta[^>]*property=["']article:(published|modified)_time["'][^>]*>\s*/gi, '');
  // Any schema the donor carried belongs to the donor.
  head = head.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  return {
    slug: route.replace(/^\/|\/$/g, '').replace(/\//g, '__'),
    route,
    url,
    bodyClass: donor.bodyClass,
    head,
    content: '',
    tail: donor.tail,
    chromeDiff: {},
    // Extra stylesheets this page needs, rendered by Shell into <head>. A
    // <link> placed in the body would work but would not be discovered until
    // the parser reached it, which is a flash of unstyled section.
    styles,
  };
}
