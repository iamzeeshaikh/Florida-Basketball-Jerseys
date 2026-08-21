#!/usr/bin/env python3
"""Turn the crawled live HTML into src/data/*.json for the Astro build.

Strict 1:1: the live rendered markup is the source of truth. Only WordPress
runtime artefacts that cannot exist on a static host are removed (wp-json,
oEmbed, RSD, shortlink, the generator tag, session nonces, the WooCommerce AJAX
bundles and the Blocks cart/checkout React stack). Everything visible -- markup,
classes, inline styles, CSS links, metadata, schema, the chat widget, and the
RSS alternate links, whose feeds are mirrored alongside -- is carried across
byte-for-byte.
"""
import os, re, json, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LIVE = os.environ.get("LIVE_DIR", os.path.join(HERE, "crawl"))
OUT = os.path.join(ROOT, "src", "data")
SITE = "https://floridabasketballjerseys.com"


# ---------------------------------------------------------------- cloudflare
def _dec(hexstr):
    b = bytes.fromhex(hexstr)
    k = b[0]
    return "".join(chr(c ^ k) for c in b[1:])


def cf_decode(h):
    """Cloudflare obfuscates addresses at its edge; the static host will not
    re-apply it, so the real address has to go back into the markup."""
    h = re.sub(r'href=["\']/cdn-cgi/l/email-protection#([0-9a-f]+)["\']',
               lambda m: 'href="mailto:%s"' % _dec(m.group(1)), h)
    h = re.sub(r'<span[^>]*class="__cf_email__"[^>]*data-cfemail="([0-9a-f]+)"[^>]*>.*?</span>',
               lambda m: _dec(m.group(1)), h, flags=re.S)
    h = re.sub(r'<a[^>]*class="__cf_email__"[^>]*data-cfemail="([0-9a-f]+)"[^>]*>.*?</a>',
               lambda m: _dec(m.group(1)), h, flags=re.S)
    h = re.sub(r'<script[^>]*src=["\']/cdn-cgi/scripts/[^"\']*email-decode[^"\']*["\'][^>]*>\s*</script>', "", h)
    return h


# ------------------------------------------------------------------- assets
# Asset URLs become root-relative so the build serves its own CSS, JS and fonts
# on any host. Page URLs, canonicals, Open Graph and schema keep the absolute
# production domain exactly as WordPress emits them.
def localise_assets(h):
    for origin in (SITE, SITE.replace("https://", "http://")):
        for folder in ("/wp-content/", "/wp-includes/"):
            h = h.replace(origin + folder, folder)
            h = h.replace(origin.replace("/", "\\/") + folder.replace("/", "\\/"),
                          folder.replace("/", "\\/"))
    return h


# ---------------------------------------------------------------- head clean
DROP_LINK_PATTERNS = [
    r'<link[^>]*rel=["\']alternate["\'][^>]*type=["\']application/json\+oembed["\'][^>]*>',
    r'<link[^>]*rel=["\']alternate["\'][^>]*type=["\']text/xml\+oembed["\'][^>]*>',
    r'<link[^>]*rel=["\']alternate["\'][^>]*type=["\']application/json["\'][^>]*>',
    r'<link[^>]*rel=["\']https://api\.w\.org/["\'][^>]*>',
    r'<link[^>]*rel=["\']EditURI["\'][^>]*>',
    r'<link[^>]*rel=["\']wlwmanifest["\'][^>]*>',
    r'<link[^>]*rel=["\']shortlink["\'][^>]*>',
    r'<link[^>]*rel=["\']pingback["\'][^>]*>',
    r'<meta[^>]*name=["\']generator["\'][^>]*>',
]

# Vendor bundles that need no WordPress backend. They are shipped unchanged so
# the behaviour they drive (sticky header, entrance animations, product gallery
# slider + zoom + lightbox, FAQ accordion in the product tabs) is the original
# code rather than a re-implementation.
KEEP_SCRIPT_SRC = [
    "/wp-includes/js/jquery/jquery.min.js",
    "/wp-includes/js/jquery/jquery-migrate.min.js",
    "/wp-includes/js/jquery/ui/core.min.js",
    "/wp-includes/js/dist/hooks.min.js",
    "/wp-includes/js/dist/i18n.min.js",
    "/wp-includes/js/wp-emoji-release.min.js",
    "/wp-content/plugins/elementor/assets/js/webpack.runtime.min.js",
    "/wp-content/plugins/elementor/assets/js/frontend-modules.min.js",
    "/wp-content/plugins/elementor/assets/js/frontend.min.js",
    "/wp-content/plugins/elementor-pro/assets/js/webpack-pro.runtime.min.js",
    "/wp-content/plugins/elementor-pro/assets/js/frontend.min.js",
    "/wp-content/plugins/elementor-pro/assets/js/elements-handlers.min.js",
    "/wp-content/plugins/elementor-pro/assets/lib/sticky/jquery.sticky.min.js",
    "/wp-content/plugins/custom-tabs/public/js/custom-tabs-public.js",
    "/wp-content/plugins/woocommerce/assets/js/flexslider/jquery.flexslider.min.js",
    "/wp-content/plugins/woocommerce/assets/js/zoom/jquery.zoom.min.js",
    "/wp-content/plugins/woocommerce/assets/js/photoswipe/photoswipe.min.js",
    "/wp-content/plugins/woocommerce/assets/js/photoswipe/photoswipe-ui-default.min.js",
    "/wp-content/plugins/woocommerce/assets/js/frontend/single-product.min.js",
    "/wp-content/plugins/woocommerce/assets/js/js-cookie/js.cookie.min.js",
    "/wp-content/themes/storefront/assets/js/navigation.min.js",
    "/wp-content/themes/storefront/assets/js/footer.min.js",
    # the live chat widget, loaded from its own host
    "chat.zeeops.dev/widget.js",
]

# Inline configuration blocks whose consumer is gone, or that only exist to talk
# to a WordPress endpoint.
DROP_INLINE_SCRIPT_MARKERS = [
    "wc_add_to_cart_params", "wc_cart_fragments_params", "wc_order_attribution",
    "wc_country_select_params", "wc_address_i18n_params", "wc_cart_params",
    "wc_checkout_params", "wc_password_strength_meter_params",
    "wcSettings", "wcBlocksRegistry", "wc-blocks-registry",
    "sbjs.init", "storefront_handheld_footer_bar",
]

KEEP_INLINE_SCRIPT_MARKERS = [
    "application/ld+json", "speculationrules",
    "wc_single_product_params",          # gallery slider / zoom / lightbox config
    "elementorFrontendConfig", "ElementorProFrontendConfig",
    "woocommerce-no-js",                 # body class swap
    "lazyloadRunObserver",               # Elementor background lazyload
    "_wpemojiSettings",                  # twemoji swap for the 🔍 gallery trigger
    "fbj-", "fbj_",                      # the site's own hand-written page scripts
]

INLINE_ID_RE = re.compile(r'id=["\']([^"\']+)-js-(?:extra|before|after)["\']')
KEEP_INLINE_IDS = {"wc-single-product", "elementor-frontend", "elementor-pro-frontend",
                   "wp-i18n"}


def keep_src(src):
    return any(k in src for k in KEEP_SCRIPT_SRC)


def drop_by_id(open_tag):
    m = INLINE_ID_RE.search(open_tag)
    return bool(m) and m.group(1) not in KEEP_INLINE_IDS


def _script_sub(m):
    tag = m.group(0)
    open_tag = tag[:tag.index(">") + 1]
    body = m.group(1)
    src = re.search(r'src=["\']([^"\']+)', open_tag)
    if src:
        return tag if keep_src(src.group(1)) else ""
    if any(k in tag or k in body for k in KEEP_INLINE_SCRIPT_MARKERS):
        return tag
    if drop_by_id(open_tag):
        return ""
    if any(k in body for k in DROP_INLINE_SCRIPT_MARKERS):
        return ""
    return tag


def strip_scripts(h):
    h = re.sub(r"<script\b[^>]*>(.*?)</script>", _script_sub, h, flags=re.S | re.I)
    h = re.sub(r"<script\b[^>]*/>", "", h, flags=re.I)
    return h


def neutralise(h):
    """No WordPress token or admin endpoint may reach the static output."""
    h = re.sub(r'"([a-z_]*nonce)":"[0-9a-zA-Z]+"', r'"\1":""', h)
    h = re.sub(r'\\"([a-z_]*nonce)\\":\\"[0-9a-zA-Z]+\\"', r'\\"\1\\":\\""', h)
    h = re.sub(r'\s(?:data-)?nonce=["\'][^"\']*["\']', "", h)
    h = re.sub(r'(<input[^>]*name="(?:_wpnonce|[\w-]*-nonce)"[^>]*value=")[^"]*(")', r"\1\2", h)
    h = h.replace(SITE + "/wp-admin/admin-ajax.php", "#")
    h = h.replace(SITE.replace("/", "\\/") + "\\/wp-admin\\/admin-ajax.php", "#")
    h = h.replace(SITE + "/wp-json/", "#")
    h = h.replace(SITE.replace("/", "\\/") + "\\/wp-json\\/", "#")
    return h


def clean_head(head):
    for p in DROP_LINK_PATTERNS:
        head = re.sub(p, "", head, flags=re.I)
    head = strip_scripts(head)
    head = re.sub(r"\n{3,}", "\n\n", head)
    return head.strip()


VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}


def slice_element(h, start_re, tag):
    m = re.search(start_re, h)
    if not m:
        return None
    i = m.start()
    depth, pos = 0, i
    open_re = re.compile(r"<(/?)(%s)\b[^>]*?(/?)>" % tag, re.I)
    while True:
        mm = open_re.search(h, pos)
        if not mm:
            return None
        pos = mm.end()
        if mm.group(3) == "/" or mm.group(2).lower() in VOID:
            continue
        depth += -1 if mm.group(1) else 1
        if depth == 0:
            return h[i:mm.end()]


# ------------------------------------------------------------------- forms
# The three forms keep their markup, labels, validation and success/error text
# exactly as they are. Only the endpoint behind them moves: WordPress is gone,
# so they post to the site's own /api/ handlers instead.

# /get-a-quote/ posted to a custom WordPress REST route.
QUOTE_ENDPOINT = ("fetch('/wp-json/fbj/v1/quote'", "fetch('/api/quote/'")

# the same script redirects to '/thank-you', which the host then 308s to the
# slashed form; go straight there instead
THANKYOU_SLASH = ("window.location.href = '/thank-you'", "window.location.href = '/thank-you/'")

# /contact/ never delivered anything on the live site -- its handler only hid
# the form and revealed the success panel (the comment in the source says so).
# The validation and its wording are untouched; the submission is now actually
# sent, and on success the visitor lands on /thank-you/ like every other form
# on the site (client's instruction, 2026-08-21 -- the live site showed an
# inline panel instead).
CONTACT_OLD = """      // Show success (in production: replace with actual form POST / WP AJAX / CF7 integration)
      form.style.display = 'none';
      successMsg.classList.add('fbj-visible');
      successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });"""
CONTACT_NEW = """      var fd = new FormData(form);
      fd.append('page_url', window.location.href);
      fetch('/api/contact/', { method: 'POST', body: fd })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (d && d.success === false) {
            alert(d.message || 'Something went wrong. Please try again.');
            return;
          }
          // every form on the site finishes on the thank-you page
          window.location.href = '/thank-you/';
        })
        .catch(function () { alert('Something went wrong. Please try again.'); });"""

PRODUCT_TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S)
QUERIED_ID_RE = re.compile(r'<body class="[^"]*postid-(\d+)')


def fix_forms(page_html, raw, slug):
    """Point the forms at the static site's own handlers and give the product
    quote form the right attribution.

    The live pages are served from SiteGround's page cache, and the cache mixes
    product pages up: every product page ships the Elementor form with another
    product's `referer_title` and `queried_id` baked in, so an enquiry names the
    wrong jersey. The correct values for this page are written instead."""
    page_html = page_html.replace(*QUOTE_ENDPOINT)
    page_html = page_html.replace(*THANKYOU_SLASH)
    if slug == "contact":
        assert CONTACT_OLD in page_html, "contact handler not found"
        page_html = page_html.replace(CONTACT_OLD, CONTACT_NEW)
    if slug.startswith("product__"):
        t = PRODUCT_TITLE_RE.search(raw)
        q = QUERIED_ID_RE.search(raw)
        if t:
            page_html = re.sub(r'(<input type="hidden" name="referer_title" value=")[^"]*(")',
                               lambda m: m.group(1) + t.group(1).strip() + m.group(2), page_html)
        if q:
            page_html = re.sub(r'(<input type="hidden" name="queried_id" value=")[^"]*(")',
                               lambda m: m.group(1) + q.group(1) + m.group(2), page_html)
        # the page the enquiry came from, so the email can name it
        page_html = page_html.replace(
            '<form class="elementor-form" method="post" name="Instant Quote"',
            '<form class="elementor-form" method="post" name="Instant Quote"'
            ' data-page-url="%s"' % (SITE + route_for(slug)))
    return page_html


def route_for(slug):
    if slug == "__home":
        return "/"
    if slug in EXTRA:
        return EXTRA[slug]
    return "/" + slug.replace("__", "/") + "/"


TAG_SPLIT = re.compile(r"(<[^>]+>)")


def tokenize(h):
    return TAG_SPLIT.split(h or "")


def tag_overrides(baseline_tokens, page_html):
    toks = tokenize(page_html)
    if len(toks) != len(baseline_tokens):
        return None
    return {str(i): t for i, (t, b) in enumerate(zip(toks, baseline_tokens)) if t != b}


# Pages the plain crawl cannot reach as a URL of their own:
#   checkout -- WordPress 302s /checkout/ to /cart/ whenever the cart is empty,
#               so it was captured with a product in the cart instead
#   404      -- the error template, captured from a URL that does not exist
#   search   -- /?s=<term>, captured from a real query
EXTRA = {"checkout": "/checkout/", "404": "/404/", "search": "/search/"}


def read_page(path):
    slug = os.path.basename(path)[:-5]
    raw = open(path, encoding="utf-8", errors="replace").read()
    raw = localise_assets(cf_decode(raw))
    head = raw[raw.find("<head>") + 6: raw.find("</head>")]
    bodym = re.search(r'<body class="([^"]*)"', raw)
    header = slice_element(raw, r'<header data-elementor-type="header"', "header")
    footer = slice_element(raw, r'<footer data-elementor-type="footer"', "footer")
    assert header and footer, slug
    hi = raw.find(header) + len(header)
    fi = raw.find(footer)
    content = raw[hi:fi]
    tail = raw[fi + len(footer): raw.rfind("</body>")]
    return dict(slug=slug, raw=raw, head=head,
                bodyClass=bodym.group(1) if bodym else "",
                header=header, footer=footer, content=content, tail=tail)


def main():
    os.makedirs(OUT, exist_ok=True)
    files = sorted(glob.glob(os.path.join(LIVE, "*.html")))
    files += sorted(glob.glob(os.path.join(HERE, "crawl-extra", "*.html")))
    parsed = [read_page(f) for f in files]

    # the shop archive carries no page-specific chrome state, so it is the
    # cleanest baseline for the shared header and footer
    base = next(p for p in parsed if p["slug"] == "product")
    chrome = {
        "header": neutralise(strip_scripts(base["header"])),
        "footer": neutralise(strip_scripts(base["footer"])),
    }
    base_tokens = {k: tokenize(chrome[k]) for k in ("header", "footer")}

    pages, unsplittable = {}, []
    for p in parsed:
        diff = {}
        for k in ("header", "footer"):
            d = tag_overrides(base_tokens[k], neutralise(strip_scripts(p[k])))
            if d is None:
                unsplittable.append((p["slug"], k))
            elif d:
                diff[k] = d
        pages[p["slug"]] = {
            "slug": p["slug"],
            "route": route_for(p["slug"]),
            "url": SITE + route_for(p["slug"]),
            "bodyClass": p["bodyClass"],
            "head": clean_head(p["head"]),
            "content": fix_forms(neutralise(strip_scripts(p["content"])), p["raw"], p["slug"]),
            "tail": neutralise(strip_scripts(p["tail"])),
            "chromeDiff": diff,
        }

    json.dump(pages, open(os.path.join(OUT, "pages.json"), "w"), indent=1)
    json.dump(chrome, open(os.path.join(OUT, "chrome.json"), "w"), indent=1)
    print("pages:", len(pages))
    print("  header %d bytes, footer %d bytes" % (len(chrome["header"]), len(chrome["footer"])))
    print("  structural mismatches:", unsplittable or "none")
    if pages:
        print("  max chrome overrides:",
              max(sum(len(v) for v in x["chromeDiff"].values()) for x in pages.values()))


if __name__ == "__main__":
    main()
