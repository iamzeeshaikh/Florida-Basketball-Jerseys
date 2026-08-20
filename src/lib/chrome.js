import chrome from '../data/chrome.json';
import { rewrite } from './site.js';

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
  if (!diff) return rewrite(chrome[name]);
  const out = tokens[name].slice();
  for (const [i, tag] of Object.entries(diff)) out[i] = tag;
  return rewrite(out.join(''));
}
