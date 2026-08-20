#!/usr/bin/env python3
"""Mirror the theme/plugin static assets the migrated pages reference.

Only CSS, JS, fonts and images are copied -- no PHP ever leaves the backup.
Everything lands under public/ at its original path so the markup keeps working
byte-for-byte, and the built site stops depending on the WordPress host.
"""
import os, re, glob, subprocess, sys, time
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUB = os.path.join(ROOT, "public")
SITE = "https://floridabasketballjerseys.com"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")

ASSET_RE = re.compile(
    r'(?:href|src)=["\'](' + re.escape(SITE) + r'/(?:wp-content|wp-includes)/[^"\'?]+)(\?[^"\']*)?["\']')
CSS_URL_RE = re.compile(r'url\(\s*["\']?([^"\')]+)["\']?\s*\)')


def local_path(url):
    return os.path.join(PUB, urlparse(url).path.lstrip("/"))


def fetch(url):
    dest = local_path(url)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest, False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    r = subprocess.run(["curl", "-sS", "-L", "--compressed", "--max-time", "90",
                        "-A", UA, "-o", dest, "-w", "%{http_code}", url],
                       capture_output=True)
    code = r.stdout.decode().strip()
    if code != "200":
        print("  !! %s -> %s" % (url, code))
        if os.path.exists(dest):
            os.remove(dest)
        return None, True
    return dest, True


def main():
    urls = set()
    for f in glob.glob(os.path.join(HERE, "crawl", "*.html")):
        h = open(f, encoding="utf-8", errors="replace").read()
        for m in ASSET_RE.finditer(h):
            if "/uploads/" in m.group(1):
                continue
            urls.add(m.group(1))
    print("referenced assets:", len(urls))

    queue, seen = list(sorted(urls)), set()
    fetched = 0
    while queue:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        dest, did = fetch(url)
        if did:
            fetched += 1
            time.sleep(0.15)
        if not dest or not dest.endswith(".css"):
            continue
        # follow url(...) references inside stylesheets: fonts, sprites, icons
        base = url.rsplit("/", 1)[0]
        css = open(dest, encoding="utf-8", errors="replace").read()
        for m in CSS_URL_RE.finditer(css):
            ref = m.group(1).strip().split("#")[0].split("?")[0]
            if not ref or ref.startswith("data:"):
                continue
            if ref.startswith("//"):
                ref = "https:" + ref
            if ref.startswith("http"):
                if not ref.startswith(SITE):
                    continue
                nxt = ref
            elif ref.startswith("/"):
                nxt = SITE + ref
            else:
                nxt = os.path.normpath(base + "/" + ref).replace(":/", "://")
            if nxt not in seen:
                queue.append(nxt)
    print("fetched:", fetched, " total:", len(seen))


if __name__ == "__main__":
    main()
