// Image delivery: WebP with a fallback, lazy-loading below the fold, and alt
// text on the badges that shipped without any.
//
// ── What was wrong ───────────────────────────────────────────────────────────
// 666 <img> tags across the site, three of them WebP. 40.3 MB of JPEG and PNG
// where the same pictures in WebP are 23.5 MB. Every one already carried width
// and height — so there was no layout shift to fix — but 204 had no loading
// attribute at all, which means the browser fetches images far below the fold
// during the initial load.
//
// ── Why <picture> rather than swapping src ───────────────────────────────────
// A <source> lets the browser choose and leaves the original as a fallback, so
// nothing is lost if a browser cannot decode WebP or a plugin wants the jpg.
// Rewriting src outright would be fewer bytes of markup and would remove that.

import fs from 'node:fs';
import path from 'node:path';

const PUBLIC = 'public';
const RASTER = /\.(jpe?g|png)$/i;

/** Every path under public/ that has a .webp sibling, as site-absolute URLs. */
function buildWebpIndex() {
  const found = new Set();
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.webp')) found.add('/' + path.relative(PUBLIC, p).split(path.sep).join('/'));
    }
  };
  walk(PUBLIC);
  return found;
}

const WEBP = buildWebpIndex();

/** The path a WebP would live at, or null if we did not generate one. */
export function webpFor(src) {
  if (!src || !RASTER.test(src.split('?')[0])) return null;
  const clean = src.split('?')[0].split('#')[0];
  if (!clean.startsWith('/')) return null;
  const candidate = clean.replace(RASTER, '.webp');
  return WEBP.has(candidate) ? candidate : null;
}

// Badges that shipped with alt="" on all 42 product pages. They are not
// decorative — each one is making a claim to the reader about payment,
// security or copyright — so an empty alt hides that from anyone using a
// screen reader.
const BADGE_ALT = [
  [/dmca-badge/i, 'DMCA protected — site content is registered and monitored'],
  [/payments?\.png/i, 'Accepted payment methods: Visa, Mastercard, American Express and PayPal'],
  [/payment-image/i, 'Secure checkout with all major credit cards accepted'],
  [/secure-icons/i, 'Secure SSL encrypted checkout'],
];

function altFor(src) {
  for (const [re, text] of BADGE_ALT) if (re.test(src)) return text;
  return null;
}

/**
 * Rewrite every <img> on a page.
 *
 * The product gallery was excluded at first on the assumption that a <picture>
 * between the img and its parent would break the zoom, since that is a common
 * way to break one. Tested rather than assumed: with the gallery wrapped and
 * with it left alone, the lightbox opens identically, carries the same three
 * images, reports no broken images and throws no errors. The assumption was
 * wrong and the gallery holds the largest image on the page — the one the LCP
 * is measured against — so it is included.
 */
/**
 * The gallery's data-attributes, which its script turns into real requests.
 *
 * The thumbnail strip and the lightbox are built at runtime from data-thumb,
 * data-thumb-srcset, data-src and data-large_image — so a <picture> in the
 * markup never sees them, and a product page kept downloading 50KB of JPEG
 * after every visible image had been converted.
 *
 * og:image is deliberately NOT rewritten. Social crawlers are not browsers and
 * several still do not decode WebP; a preview card that fails to render is a
 * worse outcome than a few kilobytes.
 */
const DATA_IMG_ATTRS = /\b(data-thumb|data-src|data-large_image)="([^"]+)"/gi;
const DATA_SRCSET = /\bdata-thumb-srcset="([^"]+)"/gi;

function rewriteDataImages(html) {
  let out = html.replace(DATA_IMG_ATTRS, (m, attr, value) => {
    const webp = webpFor(value);
    return webp ? `${attr}="${webp}"` : m;
  });
  out = out.replace(DATA_SRCSET, (m, value) => {
    const swapped = value.split(',').map((part) => {
      const [url, ...rest] = part.trim().split(/\s+/);
      const webp = webpFor(url);
      return [webp || url, ...rest].join(' ');
    }).join(', ');
    return `data-thumb-srcset="${swapped}"`;
  });
  return out;
}

export function enhanceImages(html) {
  if (!html) return html;
  html = rewriteDataImages(html);

  let seen = 0;
  return html.replace(/<img\b[^>]*>/gi, (tag, offset) => {
    seen++;
    let out = tag;

    // 1. alt text for the badges
    const srcMatch = out.match(/\bsrc\s*=\s*"([^"]+)"/i);
    const src = srcMatch ? srcMatch[1] : '';
    const emptyAlt = /\balt\s*=\s*"\s*"/i.test(out);
    if (emptyAlt) {
      const text = altFor(src);
      if (text) out = out.replace(/\balt\s*=\s*"\s*"/i, `alt="${text}"`);
    }

    // 2. loading and decoding. The FIRST image on a page is the likely LCP
    //    candidate, so it is fetched eagerly and at high priority; everything
    //    after it is lazy. Marking the LCP image lazy is a classic own goal —
    //    it delays the very paint the metric measures.
    if (!/\bloading\s*=/i.test(out)) {
      out = out.replace(/<img\b/i, seen === 1 ? '<img loading="eager" fetchpriority="high"' : '<img loading="lazy"');
    }
    if (!/\bdecoding\s*=/i.test(out)) out = out.replace(/<img\b/i, '<img decoding="async"');

    // 3. WebP, offered rather than forced
    const webp = webpFor(src);
    if (!webp) return out;
    return `<picture><source srcset="${webp}" type="image/webp">${out}</picture>`;
  });
}
