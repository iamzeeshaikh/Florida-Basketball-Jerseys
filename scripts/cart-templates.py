#!/usr/bin/env python3
"""Bake the WooCommerce Blocks cart/checkout panels captured from the live site.

Those panels are React-rendered from the Store API, which cannot exist on a
static host. The hydrated markup is stored here and replayed by cart.js against
a browser-side cart, so the pages look and behave the way the live ones do.
"""
import os, re, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "src", "data")
SITE = "https://floridabasketballjerseys.com"


def load(name):
    h = open(os.path.join(DATA, name), encoding="utf-8").read()
    h = h.replace(SITE + "/wp-content/", "/wp-content/")
    # React ids are per-render; pin them so the output is stable
    h = re.sub(r'id=":r[0-9a-z]+:"', 'id=":r0:"', h)
    h = re.sub(r'aria-controls=":r[0-9a-z]+:"', 'aria-controls=":r0:"', h)
    h = re.sub(r'data-cart-item-key="[0-9a-f]+"', 'data-cart-item-key="%%KEY%%"', h)
    return h


out = {
    "empty": load("cart-empty.html"),
    "filled": load("cart-filled.html"),
    "checkout": load("checkout-filled.html"),
}
json.dump(out, open(os.path.join(ROOT, "public", "assets", "cart-templates.json"), "w"),
          separators=(",", ":"))
print({k: len(v) for k, v in out.items()})
