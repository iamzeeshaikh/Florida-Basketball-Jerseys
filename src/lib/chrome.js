import chrome from '../data/chrome.json';
import locations from '../data/locations.json';
import { rewrite, dropFontImports } from './site.js';
import { enhanceImages } from './images.js';

// The header and footer each inlined a <style> block — 10,024 and 8,950 bytes —
// into all 76 pages. They now live in /assets/fbj-chrome.css, requested once and
// cached across the whole site, so they are removed from the markup here.
const CHROME_STYLE = /<style[^>]*>[\s\S]*?<\/style>/g;
const stripChromeStyles = (html) => (html ? html.replace(CHROME_STYLE, '') : html);

/**
 * A "Cities We Serve" column in the footer.
 *
 * The city pages exist and link to each other, but nothing on the rest of the
 * site linked to any of them — which makes them orphans: reachable from the
 * sitemap and from nowhere a reader or a crawler would actually walk. One
 * footer column fixes that for all twenty at once.
 *
 * Injected here rather than edited into chrome.json, which is the captured
 * WordPress footer and is better left as the migration artifact. This way the
 * list also stays generated from locations.json, so adding a city adds its
 * link without anyone remembering to.
 */
const FOOTER_CITY_COUNT = 8;

function citiesColumn() {
  const shown = locations.slice(0, FOOTER_CITY_COUNT);
  const links = shown
    .map((l) => `<a href="/${l.slug}/" class="fbj-ftr-col-link">${l.city} Basketball Jerseys</a>`)
    .join('\n          ');
  return `<div class="fbj-ftr-col">
        <div class="fbj-ftr-col-title">Cities We Serve</div>
        <div class="fbj-ftr-col-links">
          ${links}
          <a href="/locations/" class="fbj-ftr-col-link">All Florida cities</a>
        </div>
      </div>`;
}

const COMPANY_COL = '<div class="fbj-ftr-col">\n        <div class="fbj-ftr-col-title">Company</div>';

/**
 * A link to the jersey designer, in the footer's Company column.
 *
 * Same reasoning as the cities column: a page nothing links to is reachable
 * only from the sitemap, which is not somewhere a reader walks.
 */
function addDesigner(html) {
  if (!html || html.includes('/design-your-jersey/')) return html;
  const anchor = '<a href="/how-it-works" class="fbj-ftr-col-link">How It Works</a>';
  const i = html.indexOf(anchor);
  if (i < 0) return html;
  return html.slice(0, i)
    + '<a href="/design-your-jersey/" class="fbj-ftr-col-link">Design Your Jersey</a>\n          '
    + html.slice(i);
}

function addCities(html) {
  if (!html || html.includes('Cities We Serve')) return html;
  const i = html.indexOf(COMPANY_COL);
  if (i < 0) return html;                      // footer changed shape: leave it alone
  return html.slice(0, i) + citiesColumn() + '\n      ' + html.slice(i);
}

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
  if (!diff) return enhanceImages(addDesigner(addCities(stripChromeStyles(dropFontImports(rewrite(chrome[name]))))));
  const out = tokens[name].slice();
  for (const [i, tag] of Object.entries(diff)) out[i] = tag;
  return enhanceImages(addDesigner(addCities(stripChromeStyles(dropFontImports(rewrite(out.join('')))))));
}
