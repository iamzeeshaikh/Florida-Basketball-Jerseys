#!/usr/bin/env python3
"""Build src/data/catalogue.json: one record per product.

The loop markup is lifted verbatim from the crawled shop archive so the search
results page and any client-side re-ordering render exactly the tiles the live
site renders. The scalar fields come from the backup database.
"""
import os, re, json, glob, sqlite3, html

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB = os.environ.get("FBJ_DB", "/private/tmp/claude-501/-Users-sajjadahmad/"
                    "27005698-cc50-4f94-b080-7228342f51d8/scratchpad/fbj.db")
SITE = "https://floridabasketballjerseys.com"

LI_RE = re.compile(r'<li class="product type-product post-(\d+)[^"]*"[^>]*>.*?</li>', re.S)


def loop_markup():
    """slug -> the exact <li> WooCommerce prints for that product in a loop."""
    out = {}
    for f in sorted(glob.glob(os.path.join(HERE, "crawl", "product*.html"))):
        h = open(f, encoding="utf-8", errors="replace").read()
        h = h.replace(SITE + "/wp-content/", "/wp-content/")
        for m in LI_RE.finditer(h):
            block = m.group(0)
            link = re.search(r'href="%s/product/([a-z0-9-]+)/"' % re.escape(SITE), block)
            if not link:
                continue
            out.setdefault(link.group(1), block)
    return out


def main():
    con = sqlite3.connect(DB)
    meta = {}
    for pid, k, v in con.execute("select post_id, meta_key, meta_value from postmeta"):
        meta.setdefault(pid, {})[k] = v
    cats = {}
    for slug, name, tslug in con.execute("""
        select p.post_name, t.name, t.slug from posts p
        join term_relationships tr on tr.object_id = p.ID
        join term_taxonomy tt on tt.term_taxonomy_id = tr.term_taxonomy_id
        join terms t on t.term_id = tt.term_id
        where p.post_type='product' and tt.taxonomy='product_cat'"""):
        cats.setdefault(slug, []).append({"name": name, "slug": tslug})

    loops = loop_markup()
    products = []
    for pid, title, slug, excerpt, date in con.execute(
            "select ID, post_title, post_name, post_excerpt, post_date from posts "
            "where post_type='product' and post_status='publish' order by post_title"):
        m = meta.get(pid, {})
        products.append({
            "id": int(pid),
            "name": title,
            "slug": slug,
            "url": "/product/%s/" % slug,
            "sku": m.get("_sku", ""),
            "price": m.get("_price", ""),
            "regularPrice": m.get("_regular_price", ""),
            "stockStatus": m.get("_stock_status", ""),
            "date": date,
            "totalSales": int(m.get("total_sales") or 0),
            "categories": cats.get(slug, []),
            "shortDescription": excerpt,
            "thumbId": m.get("_thumbnail_id", ""),
            "loop": loops.get(slug, ""),
        })
    # WooCommerce Blocks shows the short description trimmed to 15 words + an
    # ellipsis, and the cart/checkout rows use the loop thumbnail. Both are
    # derived here so the client-side cart renders byte-identical rows.
    IMG = re.compile(r'<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*srcset="([^"]*)"', re.S)
    for prod in products:
        words = re.sub(r"<[^>]+>", "", prod["shortDescription"]).split()
        prod["excerpt"] = (" ".join(words[:15]) + "\u2026") if len(words) > 15 else " ".join(words)
        m = IMG.search(prod["loop"])
        if m:
            prod["imgSrc"], prod["imgAlt"], prod["imgSrcset"] = m.group(1), html.unescape(m.group(2)), m.group(3)
        else:
            prod["imgSrc"] = prod["imgAlt"] = prod["imgSrcset"] = ""

    missing = [p["slug"] for p in products if not p["loop"]]
    json.dump(products, open(os.path.join(ROOT, "src", "data", "catalogue.json"), "w"), indent=1)
    # the loop tiles + sort keys, fetched only when a visitor sorts or searches
    loops = [{"id": p["id"], "slug": p["slug"], "name": p["name"], "price": float(p["price"] or 0),
              "date": p["date"], "sales": p["totalSales"],
              "cats": [c["slug"] for c in p["categories"]],
              "text": re.sub(r"<[^>]+>", " ", p["shortDescription"]).lower(),
              "loop": p["loop"]} for p in products]
    json.dump(loops, open(os.path.join(ROOT, "public", "assets", "loops.json"), "w"),
              separators=(",", ":"))

    # the browser copy: only what the cart, search and sorting need
    slim = [{k: p[k] for k in ("id", "name", "slug", "url", "sku", "price", "excerpt",
                               "imgSrc", "imgAlt", "imgSrcset")} for p in products]
    json.dump(slim, open(os.path.join(ROOT, "public", "assets", "catalogue.json"), "w"),
              separators=(",", ":"))
    print("products:", len(products), " missing loop markup:", missing or "none")


if __name__ == "__main__":
    main()
