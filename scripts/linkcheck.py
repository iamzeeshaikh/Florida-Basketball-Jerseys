#!/usr/bin/env python3
"""Resolve every internal link and asset reference in dist/ against the local
QA server, and report the status of each.

Links that 404 on the live site are expected to 404 here too -- the migration
freezes content, so a broken link stays broken and is listed in the report
rather than quietly fixed.
"""
import os, re, sys, json, glob
from urllib.parse import urlparse, urljoin
import urllib.request

BASE = os.environ.get("QA_BASE", "http://localhost:4321")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, os.environ.get("DIST_DIR", "dist"))
SITE = "https://floridabasketballjerseys.com"

HREF = re.compile(r'(?:href|src)=["\']([^"\'>]+)["\']')
SRCSET = re.compile(r'srcset=["\']([^"\']+)["\']')

targets = {}
for f in glob.glob(os.path.join(DIST, "**", "*.html"), recursive=True):
    page = "/" + os.path.relpath(f, DIST).replace("index.html", "").replace(os.sep, "/")
    h = open(f, encoding="utf-8", errors="replace").read()
    urls = set(HREF.findall(h))
    for s in SRCSET.findall(h):
        for part in s.split(","):
            u = part.strip().split(" ")[0]
            if u:
                urls.add(u)
    for u in urls:
        u = u.strip()
        if not u or u.startswith(("data:", "mailto:", "tel:", "#", "javascript:")):
            continue
        if u.startswith(SITE):
            u = u[len(SITE):]
        elif u.startswith("http"):
            continue  # external, checked separately
        u = u.split("#")[0]
        if not u:
            continue
        if not u.startswith("/"):
            u = urljoin(page, u)
        targets.setdefault(u.split("?")[0], set()).add(page)

print(len(targets), "distinct internal targets")
bad = []
for u in sorted(targets):
    req = urllib.request.Request(BASE + u, method="GET",
                                 headers={"User-Agent": "linkcheck"})
    try:
        with urllib.request.urlopen(req) as r:
            code = r.status
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception as e:
        code = str(e)
    if code != 200:
        bad.append({"url": u, "status": code, "from": sorted(targets[u])[:6],
                    "count": len(targets[u])})
        print("  %-6s %s   (from %d page(s))" % (code, u, len(targets[u])))
os.makedirs(os.path.join(ROOT, "audit"), exist_ok=True)
json.dump({"checked": len(targets), "bad": bad},
          open(os.path.join(ROOT, "audit", "linkcheck.json"), "w"), indent=1)
print("\n%d of %d targets do not return 200" % (len(bad), len(targets)))
