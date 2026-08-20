#!/usr/bin/env python3
"""Phase 1 migration manifest: every discovered URL with the facts that have to
survive the move, written to audit/manifest.csv and audit/manifest.json."""
import os, re, csv, json, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = "https://floridabasketballjerseys.com"

TITLE = re.compile(r"<title>(.*?)</title>", re.S)
DESC = re.compile(r'<meta name="description" content="(.*?)"\s*/?>', re.S)
CANON = re.compile(r'<link rel="canonical" href="(.*?)"', re.S)
ROBOTS = re.compile(r"<meta name='robots' content='(.*?)'", re.S)
OG = re.compile(r'<meta property="og:(\w+)" content="(.*?)"', re.S)
TW = re.compile(r'<meta name="twitter:(\w+)" content="(.*?)"', re.S)
H = re.compile(r"<(h[1-6])\b[^>]*>(.*?)</\1>", re.S | re.I)
LD = re.compile(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', re.S)
IMG = re.compile(r"<img\b[^>]*>", re.I)
ATTR = lambda tag, a: (re.search(a + r'="([^"]*)"', tag) or [None, None])[1]
A = re.compile(r'<a\b[^>]*href="([^"]*)"[^>]*>(.*?)</a>', re.S | re.I)
FORM = re.compile(r"<form\b[^>]*>.*?</form>", re.S | re.I)
HIDDEN = re.compile(r'<input[^>]*type="hidden"[^>]*>', re.I)
SCRIPT_SRC = re.compile(r'<script[^>]*src=["\']([^"\']+)["\']', re.I)


def strip(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()


def gsc_urls():
    """URLs with impressions or clicks in the supplied Search Console export."""
    import zipfile, xml.etree.ElementTree as ET
    p = glob.glob(os.path.join(os.path.dirname(ROOT), "*Performance-on-Search*.xlsx"))
    if not p:
        return {}
    z = zipfile.ZipFile(p[0])
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    shared = ["".join(t.text or "" for t in si.iter(ns + "t"))
              for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(ns + "si")]
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    names = [s.get("name") for s in wb.iter(ns + "sheet")]
    idx = names.index("Pages") + 1
    sh = ET.fromstring(z.read("xl/worksheets/sheet%d.xml" % idx))
    out = {}
    for row in sh.iter(ns + "row"):
        vals = []
        for c in row.findall(ns + "c"):
            v = c.find(ns + "v")
            vals.append(shared[int(v.text)] if c.get("t") == "s" and v is not None
                        else (v.text if v is not None else ""))
        if vals and vals[0].startswith("http"):
            out[vals[0]] = {"clicks": float(vals[1] or 0), "impressions": float(vals[2] or 0)}
    return out


def main():
    gsc = gsc_urls()
    pages = json.load(open(os.path.join(ROOT, "src", "data", "pages.json")))
    sitemap_urls = set()
    for f in glob.glob(os.path.join(ROOT, "public", "*-sitemap.xml")):
        sitemap_urls |= set(re.findall(r"<loc>([^<]+)</loc>", open(f).read()))

    rows = []
    for slug, page in sorted(pages.items(), key=lambda kv: kv[1]["route"]):
        src = os.path.join(HERE, "crawl", slug + ".html")
        if not os.path.exists(src):
            src = os.path.join(HERE, "crawl-extra", slug + ".html")
        raw = open(src, encoding="utf-8", errors="replace").read()
        head = raw[raw.find("<head>"):raw.find("</head>")]
        body = raw[raw.find("</head>"):]
        og = dict(OG.findall(head))
        tw = dict(TW.findall(head))
        heads = [(t.lower(), strip(x)) for t, x in H.findall(body)]
        links = [(h, strip(t)) for h, t in A.findall(body)]
        imgs = [(ATTR(t, "src"), ATTR(t, "alt")) for t in IMG.findall(body)]
        forms = FORM.findall(body)
        ld = []
        for block in LD.findall(raw):
            try:
                j = json.loads(block)
            except Exception:
                continue
            for o in (j if isinstance(j, list) else [j]):
                if isinstance(o, dict) and "@type" in o:
                    ld.append(o["@type"] if isinstance(o["@type"], str) else "/".join(o["@type"]))
        url = SITE + page["route"]
        rows.append({
            "url": url,
            "source": ", ".join(filter(None, [
                "sitemap" if url in sitemap_urls else "",
                "gsc" if url in gsc else "",
                "navigation/internal" if url not in sitemap_urls else "",
            ])) or "internal",
            "gsc_clicks": gsc.get(url, {}).get("clicks", 0),
            "gsc_impressions": gsc.get(url, {}).get("impressions", 0),
            "status": 200,
            "title": strip((TITLE.search(head) or [None, ""])[1]),
            "description": (DESC.search(head) or [None, ""])[1],
            "canonical": (CANON.search(head) or [None, ""])[1],
            "robots": (ROBOTS.search(head) or [None, ""])[1],
            "og": " | ".join("%s=%s" % kv for kv in sorted(og.items())),
            "twitter": " | ".join("%s=%s" % kv for kv in sorted(tw.items())),
            "h1": " || ".join(t for k, t in heads if k == "h1"),
            "h2": " || ".join(t for k, t in heads if k == "h2"),
            "h3_count": sum(1 for k, _ in heads if k == "h3"),
            "schema": ",".join(sorted(set(ld))),
            "internal_links": sum(1 for h, _ in links if h.startswith("/") or h.startswith(SITE)),
            "external_links": sum(1 for h, _ in links if h.startswith("http") and not h.startswith(SITE)),
            "images": len(imgs),
            "images_without_alt": sum(1 for s, a in imgs if not a),
            "forms": len(forms),
            "hidden_fields": sum(len(HIDDEN.findall(f)) for f in forms),
            "scripts": len(set(SCRIPT_SRC.findall(raw))),
        })

    os.makedirs(os.path.join(ROOT, "audit"), exist_ok=True)
    with open(os.path.join(ROOT, "audit", "manifest.csv"), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    json.dump(rows, open(os.path.join(ROOT, "audit", "manifest.json"), "w"), indent=1)
    print("manifest rows:", len(rows))
    print("in sitemap:", sum(1 for r in rows if "sitemap" in r["source"]))
    print("with GSC traffic:", sum(1 for r in rows if r["gsc_impressions"]))
    missing = sorted(u for u in sitemap_urls if u not in {r["url"] for r in rows})
    print("sitemap URLs with no route:", missing or "none")


if __name__ == "__main__":
    main()
