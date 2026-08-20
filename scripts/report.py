#!/usr/bin/env python3
"""Assemble MIGRATION-REPORT.md from the audit artefacts, so every number in it
is one the harness actually produced."""
import os, json, csv, re, glob, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
AUDIT = os.path.join(ROOT, "audit")


def load(name, default=None):
    p = os.path.join(AUDIT, name)
    if not os.path.exists(p):
        return default
    return json.load(open(p))


def main():
    manifest = load("manifest.json", [])
    compare = load("compare.json", [])
    shots = load("screenshots.json", [])
    runtime = load("runtime.json", [])
    functional = load("functional.json", [])
    cart = load("cart-check.json", [])
    links = load("linkcheck.json", {"checked": 0, "bad": []})
    pages = json.load(open(os.path.join(ROOT, "src/data/pages.json")))
    redirects = json.load(open(os.path.join(ROOT, "src/data/redirects.json")))
    catalogue = json.load(open(os.path.join(ROOT, "src/data/catalogue.json")))

    sitemap_urls = set()
    for f in glob.glob(os.path.join(ROOT, "public", "*-sitemap.xml")):
        sitemap_urls |= set(re.findall(r"<loc>([^<]+)</loc>", open(f).read()))

    routes = {p["route"] for p in pages.values()}
    stats = {
        "sitemap_urls": len(sitemap_urls),
        "routes": len(routes),
        "compare_total": len(compare),
        "compare_ok": sum(1 for c in compare if c["ok"]),
        "shots_total": len(shots),
        "shots_ok": sum(1 for s in shots if not s.get("error") and s.get("pct", 1) < 0.02),
        "runtime_total": len(runtime),
        "runtime_ok": sum(1 for r in runtime if not r["failed"] and not r["bad"]
                          and not r["errors"] and not r["fonts"] and not r["overflow"]),
        "functional_total": len(functional),
        "functional_ok": sum(1 for f in functional if f["pass"]),
        "cart_total": len(cart),
        "cart_ok": sum(1 for c in cart if c["pass"]),
        "links_checked": links["checked"],
        "links_bad": len([b for b in links["bad"] if b["status"] != 308]),
        "redirects": len(redirects["redirects"]),
        "products": len(catalogue),
        "images": sum(1 for _ in glob.glob(os.path.join(ROOT, "public/wp-content/uploads/**/*"), recursive=True)
                      if os.path.isfile(_)),
    }
    json.dump(stats, open(os.path.join(AUDIT, "stats.json"), "w"), indent=1)
    for k, v in stats.items():
        print("%-18s %s" % (k, v))


if __name__ == "__main__":
    main()
