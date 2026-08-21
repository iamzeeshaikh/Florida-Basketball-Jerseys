#!/usr/bin/env python3
"""Regenerate public/sitemap.xml as one flat sitemap covering the whole site.

Every indexable page in dist/ gets one <url> entry, keyed by the page's own
canonical URL so that case-variant and paginated duplicates collapse onto the
URL they point at. Pages carrying a noindex robots directive are left out --
a sitemap is a list of pages we want indexed.

<lastmod> and the <image:image> children are carried over from the Yoast
sitemaps the WordPress site published, kept in scripts/yoast-sitemaps/ as the
source of that data. Pages Yoast never listed (pagination, mostly) fall back to
their own article:modified_time.

Run after `astro build`; it reads dist/ and writes public/sitemap.xml.
"""
import glob
import os
import re
import sys
import urllib.parse
from xml.sax.saxutils import escape

SITE = "https://floridabasketballjerseys.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
YOAST = os.path.join(ROOT, "scripts", "yoast-sitemaps")
OUT = os.path.join(ROOT, "public", "sitemap.xml")

CANONICAL = re.compile(r'rel=["\']canonical["\'][^>]*href=["\']([^"\']+)', re.I)
CANONICAL_ALT = re.compile(r'href=["\']([^"\']+)["\'][^>]*rel=["\']canonical', re.I)
NOINDEX = re.compile(r'name=["\']robots["\'][^>]*content=["\'][^"\']*noindex', re.I)
MODIFIED = re.compile(r'property=["\']article:modified_time["\'][^>]*content=["\']([^"\']+)', re.I)


def yoast_data():
    """{url: (lastmod, [image urls])} from the sitemaps WordPress published."""
    data = {}
    for f in sorted(glob.glob(os.path.join(YOAST, "*-sitemap.xml"))):
        for block in re.findall(r"<url>(.*?)</url>", open(f, encoding="utf-8").read(), re.S):
            loc = re.search(r"<loc>(.*?)</loc>", block)
            if not loc:
                continue
            lastmod = re.search(r"<lastmod>(.*?)</lastmod>", block)
            images = re.findall(r"<image:loc>(.*?)</image:loc>", block)
            data[loc.group(1)] = (lastmod.group(1) if lastmod else None, images)
    return data


def pages():
    """{canonical url: lastmod-from-page} for every indexable page in dist/."""
    found = {}
    for path in glob.glob(os.path.join(DIST, "**", "index.html"), recursive=True):
        html = open(path, encoding="utf-8", errors="replace").read()
        if NOINDEX.search(html):
            continue
        m = CANONICAL.search(html) or CANONICAL_ALT.search(html)
        if not m:
            continue
        url = m.group(1)
        if not url.startswith(SITE + "/"):
            continue
        mod = MODIFIED.search(html)
        # A canonical shared by two case-variants is written once; either copy
        # carries the same modified time, so first-wins is safe.
        found.setdefault(url, mod.group(1) if mod else None)
    return found


def sort_key(url):
    path = urllib.parse.urlparse(url).path
    return (path != "/", path)


def main():
    yoast = yoast_data()
    urls = pages()
    if not urls:
        sys.exit("no indexable pages found in %s -- run astro build first" % DIST)

    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml-stylesheet type="text/xsl" href="/wp-content/plugins/wordpress-seo/css/main-sitemap.xsl"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
        ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ]
    dropped_images = []
    for url in sorted(urls, key=sort_key):
        lastmod, images = yoast.get(url, (None, []))
        lastmod = lastmod or urls[url]
        out.append("\t<url>")
        out.append("\t\t<loc>%s</loc>" % escape(url))
        if lastmod:
            out.append("\t\t<lastmod>%s</lastmod>" % escape(lastmod))
        for img in images:
            rel = urllib.parse.unquote(urllib.parse.urlparse(img).path)
            # Only advertise images the build actually ships; a sitemap entry
            # for a missing file is a guaranteed Search Console error.
            if not os.path.isfile(os.path.join(DIST, rel.lstrip("/"))):
                dropped_images.append(img)
                continue
            out.append("\t\t<image:image>")
            out.append("\t\t\t<image:loc>%s</image:loc>" % escape(img))
            out.append("\t\t</image:image>")
        out.append("\t</url>")
    out.append("</urlset>")
    out.append("")

    open(OUT, "w", encoding="utf-8").write("\n".join(out))
    n_img = sum(1 for line in out if "<image:loc>" in line)
    print("%s: %d urls, %d images -> %s" % (SITE, len(urls), n_img, os.path.relpath(OUT, ROOT)))
    if dropped_images:
        print("  dropped %d image(s) with no file in the build:" % len(dropped_images))
        for i in dropped_images[:5]:
            print("   ", i)


if __name__ == "__main__":
    main()
