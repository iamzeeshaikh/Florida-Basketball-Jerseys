#!/usr/bin/env python3
"""Fetch the raw HTML of every live URL.

The live host answers from SiteGround's page cache, and a cache-busting query
string is deliberately NOT used: WordPress echoes the request URI into several
places (form action, pagination, ItemList schema) and a stray parameter would
be frozen into the build. Pages are re-fetched and compared instead.
"""
import os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "crawl")
URLS = os.path.join(HERE, "urls.txt")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")


def slug_for(url):
    p = url.replace("https://floridabasketballjerseys.com/", "").rstrip("/")
    return p.replace("/", "__") or "__home"


def main():
    os.makedirs(OUT, exist_ok=True)
    urls = [u.strip() for u in open(URLS) if u.strip()]
    short = []
    for url in urls:
        raw = subprocess.run(
            ["curl", "-s", "--compressed", "--max-time", "120", "-A", UA, url],
            capture_output=True).stdout.decode("utf-8", "replace")
        open(os.path.join(OUT, slug_for(url) + ".html"), "w").write(raw)
        flag = ""
        if len(raw) < 40000:
            flag = "  <-- SHORT RESPONSE"
            short.append(slug_for(url))
        print("%-52s %8d bytes%s" % (slug_for(url), len(raw), flag))
        time.sleep(1.0)
    print("\nshort pages:", short or "none")


if __name__ == "__main__":
    main()
