import chrome from '../data/chrome.json';
import { rewrite, dropFontImports } from './site.js';

// The header and footer each inlined a <style> block — 10,024 and 8,950 bytes —
// into all 76 pages. They now live in /assets/fbj-chrome.css, requested once and
// cached across the whole site, so they are removed from the markup here.
const CHROME_STYLE = /<style[^>]*>[\s\S]*?<\/style>/g;
const stripChromeStyles = (html) => (html ? html.replace(CHROME_STYLE, '') : html);

const TAG_SPLIT = /(<[^>]+>)/;
const tokens = {
  header: chrome.header.split(TAG_SPLIT),
  footer: chrome.footer.split(TAG_SPLIT),
};

/**
 * Rebuild a chrome region for one page. The header and footer are byte-
 * identical across every page on this site, so `chromeDiff` is normally empty;
 * it is kept so a future page that does differ still reproduces exactly.
 */
export function region(name, page) {
  const diff = page.chromeDiff?.[name];
  if (!diff) return stripChromeStyles(dropFontImports(rewrite(chrome[name])));
  const out = tokens[name].slice();
  for (const [i, tag] of Object.entries(diff)) out[i] = tag;
  return stripChromeStyles(dropFontImports(rewrite(out.join(''))));
}
