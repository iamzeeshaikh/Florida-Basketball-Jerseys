# floridabasketballjerseys.com — WordPress/WooCommerce → Astro migration report

**Status: LIVE.** Cut over to the production domain on 2026-08-21. All 75
routes answer 200 on <https://floridabasketballjerseys.com>, `www` 301s to the
apex, and the three forms were tested end to end from the live domain (8/8).

- Live: <https://floridabasketballjerseys.com>
- Staging: <https://floridabasketballjerseys.vercel.app> (`X-Robots-Tag: noindex, nofollow`;
  the production domain does not carry it — verified)
- Source: `~/Documents/Florida Basketball Jerseys/site`
- Repository: <https://github.com/iamzeeshaikh/Florida-Basketball-Jerseys> (public)
- Vercel project: `iamzeeshaikhs-projects/floridabasketballjerseys` — deployed
  from the CLI, not Git-connected, so a push does not trigger a deploy

The brief was a strict 1:1 migration, and that is what this is. The live rendered
markup is the source of truth: the Elementor header, footer and page bodies, the
Storefront/WooCommerce archive, product, cart, checkout and account templates,
every meta tag, schema block, inline style and hand-written page script were
carried across unchanged. Nothing was redesigned, rewritten, corrected or
removed. Where the live site is broken, the migration is broken in the same way
and the defect is listed in §16 rather than quietly fixed.

No PHP, theme or plugin code is part of the build. `database.sql`,
`sgs_encrypt_key.php` and the plugin/theme source stayed outside `public/`; the
only things taken from them are content, metadata, configuration and the static
CSS, JavaScript, fonts and media the pages already load.

---

## 1. Total original URLs

| Source | URLs |
|---|---|
| Yoast's sitemap index + 4 child sitemaps | 68 |
| Discovered from navigation, footer, internal links and the database, not in the sitemap | 8 |
| **Total distinct live URLs that return 200** | **76** |

The 8 beyond the sitemap: `/product/page/2/`, `/product/page/3/`,
`/brand/florida-basketball-jerseys/page/2/`, `/brand/florida-basketball-jerseys/page/3/`,
`/my-account/lost-password/`, `/product-category/uncategorized/`, `/search/`
(`/?s=…`), and the 404 template.

Also preserved, outside the page count: `robots.txt`, one flat `sitemap.xml`
(the five Yoast files were consolidated into it on 2026-08-21; each of their old
paths 301s there) and the Yoast XSL stylesheet, `/favicon.ico`, and 11 RSS feeds (`/feed/`,
`/comments/feed/`, `/product/feed/`, the brand feed and 8 product-category feeds).

Every URL with a click or an impression in the supplied Search Console export is
present — 39 HTML pages plus 10 image URLs, all 49 resolve.

## 2. Total Astro routes

**76 HTML routes**, one per live URL. Plus 11 feeds, `sitemap.xml`, `robots.txt`,
the sitemap XSL, and 1,678 media files served from their original
`/wp-content/uploads/…` paths.

## 3. Missing URLs

**None.** `scripts/manifest.py` cross-checks every `<loc>` in `sitemap.xml`
against the built routes: *"sitemap URLs with no route: none"*.

## 4. Redirect comparison

| Live behaviour | Astro behaviour | Match |
|---|---|---|
| `www.` → apex, 301 | 301 via `vercel.json` host rule | yes |
| No trailing slash → trailing slash, 301 | 308 (`trailingSlash: true`) | same destination, 308 not 301 |
| 42 × `/product/import-placeholder-for-NNN/` → the current product slug, 301 | 301, explicit rules | yes |
| `/product/page/1/`, `/brand/…/page/1/` → archive root, 301 | 301 | yes |
| `/favicon.ico` → the 32×32 site icon, 302 | 302 | yes |
| `/checkout/` → `/cart/` when the cart is empty, 302 | client-side redirect on an empty cart | same outcome |
| `/?s=term` renders search results in place | 302 → `/search/?s=term` | deviation, see §16 |
| Mixed-case URL (`/About/`, `/ABOUT/`) served as 200 | 200 via the case-insensitive fallback | yes |
| Unknown URL → 404 with the Storefront error page | same page, 404 | yes |

The only differences are the 308-vs-301 trailing-slash status (both permanent,
Vercel does not emit 301 for its trailing-slash rule) and the search URL.

## 5. Content differences

**None.** `scripts/compare.mjs` renders every route twice in the same Chromium —
the WordPress page replayed from the crawl, and the Astro page — and compares the
post-JS DOM: visible text and its order, every heading, every internal and
external link with its anchor text, every image and its `alt`, every form and its
field list, the JSON-LD, and the `<body>` class list.

**73 of 75 comparable routes are byte-identical.** The two that are not are
`/cart/` and `/checkout/`, where the *replayed original* cannot render: those
panels are drawn by WooCommerce Blocks from a Store API that only exists on the
WordPress host, so the replay shows an error panel instead of the real one. Those
two are verified separately in §12 against the markup captured from the live
store, and match.

Grammar, spelling, capitalisation and factual claims were not touched — including
the site-name misspelling "Florida Basktetball Jerseys" in every `<title>`
suffix, which is preserved exactly.

## 6. Metadata differences

**None.** Compared per route: `<title>`, meta description, canonical, meta
robots, all seven Open Graph properties, the Twitter card, and the
`google-site-verification` tag (present on all 76 routes). The six `noindex,
follow` routes on the live site — `/cart/`, `/checkout/`, `/my-account/`,
`/my-account/lost-password/`, `/search/`, 404 — carry the same directive.

The `http://` scheme WordPress emits in some `og:image` values is preserved
as-is; correcting it is an SEO change, not a migration one. The sitemap index was
the exception — it moved to `/sitemap.xml` on 2026-08-21 and its child `<loc>`
entries were switched to `https://` at the same time.

## 7. Missing images

**None.** All 1,458 media references across the site resolve, and the 10 image
URLs that earn impressions in Search Console are all present. Every `<img>` keeps
its original `src`, `srcset`, `sizes`, `width`, `height`, `loading` and `alt`.

## 8. Broken internal links

`scripts/linkcheck.py` resolved all **1,710** distinct internal targets in the
build. One does not return 200:

- `/product/practice-basketball-jerseys/` — linked from all 42 product pages.
  **It 404s on the live site too.** Preserved as-is under the content freeze; see §16.

43 further targets answer 308 rather than 200 — these are links written without a
trailing slash (`/contact`, `/faq`, `/refund-policy`, …) that WordPress also
redirects. Same destination, permanent redirect.

## 9. Schema differences

**None.** Every JSON-LD block is carried across verbatim and compared after
parsing:

| Type | Routes |
|---|---|
| `LocalBusiness` | 76 |
| `Product` (with `offers`, `aggregateRating`, `review`, `image`) | 42 |
| `ItemList` | 11 |
| `FAQPage` | 2 |
| `Organization` | 1 |

Breadcrumbs, `sameAs`, `priceValidUntil`, the `mpn`/`sku` pairs and the review
nodes are unchanged. See §16 for what those review nodes actually contain.

## 10. Product-data differences

**None.** 42 products, each with its name, URL, SKU, product ID, category, brand,
featured image, gallery, short description, specification table, FAQ tab, price
($4.00), availability, schema and related-products block reproduced exactly.

## 11. Form test results

Tested for real against the live domain (`scripts/form-e2e.mjs`) — **8/8
passed**, with genuine emails accepted by the SMTP server:

| Form | Result |
|---|---|
| Product "Instant Quote" (42 pages, with file upload) | endpoint 200, lands on `/thank-you/`, attachment delivered |
| `/get-a-quote/` (with file upload) | endpoint 200, lands on `/thank-you/` |
| `/contact/` | endpoint 200, lands on `/thank-you/` |
| `/contact/` empty submission | still blocked with the live wording, verbatim |

**All three forms finish on `/thank-you/`** — the client's instruction of
2026-08-21, and a deliberate departure from the live behaviour, where only
`/get-a-quote/` redirected and the other two showed an inline message.

Fixed at the same time: Elementor Pro's own form bundle is still loaded (it
drives the product tabs and the WooCommerce widgets) and was binding a second
submit handler that POSTed to `admin-ajax.php`. With WordPress gone that POST
failed and painted its `error` message beside our success one. The submit is
now caught on the document in the capture phase and stopped there, so
Elementor's handler never runs.

Field names, labels, placeholders, required flags, the honeypot, validation
messages and success/error text are unchanged. Delivery uses the transport
recovered from the site's own `wp_mail_smtp` configuration
(`smtp.gmail.com:587`, STARTTLS) and the recipients WordPress was configured
with — the two Gmail inboxes recorded in `.env` and in the Vercel project's
environment variables (kept out of the repository).

**Product attribution is fixed.** On the live site every product page ships the
Instant Quote form with *another* product's `referer_title` and `queried_id`
baked in — SiteGround's page cache serving one product's fragment on another's
page — so an enquiry names the wrong jersey. The migrated form carries the
correct product name, product ID and originating page URL, asserted in the test.

**The contact form never delivered anything on the live site.** Its handler only
hid the form and revealed the success panel; the source comment says *"replace
with actual form POST"*. It now actually sends, with the panel and wording
unchanged.

## 12. Cart and checkout test results

WooCommerce Blocks rendered `/cart/` and `/checkout/` from a Store API. That
cannot exist on a static host, so the hydrated panels were captured from the live
store and are replayed against a browser-side cart. `scripts/cart-check.mjs` —
**15/15 passed**:

- empty `/checkout/` lands on `/cart/`, matching WordPress's 302
- the empty-cart panel matches the captured live markup
- Add To Cart from a product page returns to the product page (the live site
  shows no confirmation either — its page cache swallows the notice)
- the filled-cart panel matches the captured live markup
- quantity + / − and the line and estimated totals update
- the coupon panel opens
- Proceed to Checkout points at `/checkout/`
- the checkout panel matches the captured live markup
- checkout shows **"There are no payment methods available. Please contact us for
  help placing your order."** — the live store's real state; no gateway is enabled
- Place Order surfaces that same error and cannot complete, as on the live store
- removing the last line returns the empty cart
- archive Add to cart marks the button `added` and appends the "View cart" link,
  exactly as WooCommerce's AJAX handler did

The store has never taken an order: `wc_orders` is empty and every gateway is
disabled. The real conversion path is the quote forms.

## 13. Desktop, tablet and mobile visual differences

Full-page screenshots of both sides at the same widths, pixel-diffed
(`scripts/screenshots.mjs`). Infinite CSS animations are frozen, Elementor
entrance animations landed, lazy images forced eager, and the chat widget hidden
on both sides — it opens on a timer of its own and is not a migration difference.

| Width | Coverage | Result |
|---|---|---|
| 1440 px | every route (76) | identical |
| 768 px | one page of every template | identical |
| 390 px | one page of every template | identical |
| 320 px | one page of every template | identical |

136 of the 141 shot pairs are pixel-identical. Four differ by 0.013 %–0.053 % —
a handful of anti-aliasing pixels on text and a 1-px border offset from
sub-pixel rounding, six affected pixel rows on a page thousands of rows tall.
`/checkout/` cannot be compared this way (the replayed original does not
hydrate); it is covered by §12.

## 14. Tracking verification

The live site carries no GA4, no Google Tag Manager, no Meta pixel and no
conversion tags. What it does carry is preserved:

- `google-site-verification` meta tag — on all 76 routes
- the ZeeOps live chat widget (`chat.zeeops.dev/widget.js?siteId=floridabasketball`),
  including the duplicated script tag the live pages emit
- WordPress's speculation-rules prefetch block
- the Merchant listings that Search Console reports come from the `Product`
  JSON-LD, which is unchanged — there was no Merchant Center feed plugin installed

Cloudflare's Web Analytics beacon is injected at the edge, not from the HTML, and
will follow whatever host serves the domain.

## 15. Local-asset cutover results

Every route rendered from a copy serving all of its own CSS, JavaScript, fonts,
images and media, at 1440 / 390 / 320 px — 228 page renders
(`scripts/runtime-check.mjs`). **228/228 clean:**

- zero missing assets
- zero failed essential requests
- zero JavaScript errors
- zero font failures
- zero WordPress runtime dependency — `off-site requests: none beyond the
  allowed hosts`, those being the three the live site also calls: Google Fonts,
  the ZeeOps chat host, and the `s.w.org` twemoji sprite
- horizontal overflow at 320 px and 390 px: 152 renders overflow, **every one of
  them inheriting the original's overflow, none a regression** — the harness
  measures the replayed WordPress page for each and compares. See §16 item 4.

A `*.vercel.app` host cannot prove this on its own, which is why it is measured
from the local copy.

## 16. Remaining issues

### Live-site defects preserved deliberately (content freeze)

1. **`/product/practice-basketball-jerseys/` 404s** and is linked from all 42
   product pages. The product does not exist; the "Practice Jerseys" card points
   at a slug that was never created.
2. **Footer "Blog" link → `/blog`, 404.** No blog exists — zero posts, no post
   sitemap.
3. **`/sitemap/` links to 28 `/product-category/…` URLs that do not exist**
   (`/product-category/jerseys`, `/product-category/black-jerseys`, …), plus
   `/shop` and `/about-us`. All 404 on the live site.
4. **The header overflows horizontally below ~500 px.** `div.fbj-hdr-actions` and
   the burger push the page to 495 px wide at both 390 px and 320 px. Measured
   identically on both sides — the migration does not make it worse.
5. **Every product page's long-copy section says "What Is a Sublimated Basketball
   Jersey?"** regardless of the product. It is template text on the live site.
6. **Product schema carries a fabricated review.** Each `Product` node has
   `aggregateRating` 5/5 with `reviewCount: 1` and one `Review` authored
   "webmaster", generated by the schema plugin. The store has **no real reviews** —
   `_wc_review_count` is 0 on all 42 products and reviews are disabled. Search
   Console shows 423 impressions on Review-snippet appearances riding on it.
   **Reviewed and kept, on the client's instruction (2026-08-20).** Preserved
   exactly as the live site publishes it. Worth knowing: this is the same
   pattern that endangered the zeecustomboxes.com Merchant listings, so if
   Merchant Center ever queries the listings, this is the first place to look.
7. **The published NAP looks fictional.** Phone `(407) 555-0192` is in the
   555-01xx range reserved for fiction, and the address `4820 S. Orange Ave,
   Suite 110, Orlando, FL 32806` appears in the LocalBusiness schema, the footer
   and the header. **Reviewed and kept, on the client's instruction
   (2026-08-20).** Preserved exactly. If real details are supplied later they
   are a one-place change: the header, footer and LocalBusiness schema all read
   from the same captured markup.
8. **Checkout cannot take an order** — no payment gateway is enabled.
9. `http://` scheme in some `og:image` values. (The sitemap's child `<loc>`
   entries and the `robots.txt` Sitemap line were corrected to `https://` when
   the sitemap moved to `/sitemap.xml` on 2026-08-21.)
10. The site name is misspelled "Florida Basktetball Jerseys" in every `<title>`
    suffix, the RSS channel titles and the schema `brand`.
11. The chat widget script tag is emitted twice on every page.

### Deviations forced by leaving WordPress

12. **Asset URLs are root-relative** (`/wp-content/…`) instead of absolute. No
    visible effect; it is what stops the site depending on the WordPress host.
13. **Trailing-slash redirects are 308, not 301.** Same destination, same
    permanence.
14. **`/?s=term` 302s to `/search/?s=term`.** Vercel matches `index.html` for `/`
    before any rewrite, so the search URL cannot be served in place. The results,
    heading, sorting control and result count are identical; the page is
    `noindex` and reachable only from the 404 page's search box.
15. **Related products are frozen per page.** WooCommerce ordered them
    `rand`, so a static page cannot match a live reload. Each product page keeps
    the four the crawl captured, from the same category. The same applies to the
    empty cart's "New in store" grid and the 404 page's product grids.
16. **My account has no accounts to authenticate.** Registration was disabled and
    no customer ever registered. The login and lost-password forms keep their
    markup and WooCommerce's own wording, and answer with WooCommerce's standard
    "no such account" error.
17. **Archive sorting (`?orderby=`) and search are rendered client-side** from the
    same product tiles WooCommerce emits. Sorting by popularity, date and price
    reproduces WooCommerce's ordering; search matches on product name and short
    description, which returned the same result set as the live site on the case
    tested (`mesh` → 3 products).

### Decided

18. **The product review schema stays** (item 6) — confirmed 2026-08-20. Not to
    be raised again.
19. **The published phone number and address stay** (item 7) — confirmed
    2026-08-20. Not to be raised again.

### Open

20. **DNS cutover** — not done, and will not be until you say so.
21. **Vercel preview-environment variables are not set.** The SMTP settings are
    on Production and Development; the CLI would not write the Preview scope
    non-interactively. Deployments made with `vercel --prod` (including the
    staging URL) are unaffected — but a branch preview would not send mail until
    those are added in the dashboard.

## 17. Production deployment recommendation

**Ready to cut over whenever you say.** The audit is clean on everything that is
measurable: 73/75 routes DOM-identical with the remaining two verified against
captured live markup, 138/140 screenshot pairs pixel-identical and the rest
inside anti-aliasing noise, 29/29 functional checks, 15/15 cart and checkout
checks, 8/8 real form submissions delivered from the deployed site, 1,709 of
1,710 internal targets resolving with the one exception being a link the live
site also breaks, and 228/228 page renders clean when the site serves every
asset itself.

Items 6 and 7 above were reviewed and deliberately kept, so nothing is
outstanding but your go-ahead. Cutover steps when you give it:

1. Add `floridabasketballjerseys.com` and `www.floridabasketballjerseys.com` to
   the Vercel project; the `www` → apex 301 is already configured.
2. Point DNS at Vercel. The `X-Robots-Tag: noindex` rule is scoped to
   `*.vercel.app` hosts only — the production domain will not inherit it.
3. Re-run `node scripts/form-e2e.mjs https://floridabasketballjerseys.com` and
   confirm the three forms deliver from the live domain.
4. Submit `sitemap.xml` in Search Console and watch the 39
   traffic-receiving URLs for a fortnight.

Do **not** start the SEO phase until that fortnight is clean — items 1–5 and
8–11 above are the backlog for it, and every one of them is deliberately
untouched today. Items 6 and 7 are settled and stay as they are.

---

## Appendix — how to reproduce the audit

```bash
npm install
python3 scripts/crawl.py            # fetch the live HTML
python3 scripts/mirror.py           # mirror the static assets it references
node    scripts/mirror-runtime.mjs  # and the ones JavaScript pulls in
node    scripts/capture-cart.mjs    # capture the hydrated cart/checkout panels
python3 scripts/extract.py          # split into src/data/pages.json + chrome.json
python3 scripts/catalogue.py        # product data + loop tiles
python3 scripts/cart-templates.py   # bake the cart/checkout templates
npm run build                       # dist/
SITE_ORIGIN=http://localhost:4321 OUT_DIR=./dist-qa npm run build
DIST_DIR=dist-qa node scripts/serve.mjs &

node    scripts/compare.mjs         # rendered-DOM parity, both sides in Chromium
node    scripts/screenshots.mjs     # full-page pixel diff at 1440/768/390/320
node    scripts/functional.mjs      # navigation, menus, gallery, tabs, search
node    scripts/cart-check.mjs      # cart and checkout against the live markup
node    scripts/runtime-check.mjs   # local-asset cutover conditions
python3 scripts/linkcheck.py        # every internal target
python3 scripts/manifest.py         # the Phase 1 inventory
node    scripts/form-e2e.mjs <url>  # real submissions against a deployment
```

Artefacts land in `audit/`: `manifest.csv`, `compare.json`, `screenshots.json`,
`functional.json`, `cart-check.json`, `runtime.json`, `linkcheck.json`,
`form-e2e.json`, and the screenshot pairs and diffs in `audit/shots/`.
