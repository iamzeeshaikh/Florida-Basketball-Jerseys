#!/usr/bin/env python3
"""Self-host the site's four font families instead of fetching them from Google.

Why: the hero on every state, city and article page was shifting by 0.08-0.10
at roughly four seconds, twice, as the webfonts swapped in. Cumulative layout
shift on those pages was 0.205 against a 0.1 budget, and the cause was the
request chain -- fonts.googleapis.com for the CSS, then fonts.gstatic.com for
each file, which is two DNS lookups, two TLS handshakes and two round trips
before a single glyph exists.

Self-hosting collapses that to one same-origin request per file, and makes the
file paths stable enough to preload -- which is what actually removes the
shift, because the font is then available at first paint rather than arriving
after it.

Only the weights the site actually renders are fetched. That list came from
walking every element's computed style across the site and comparing it with
document.fonts, not from guessing: it is how we found that Barlow 800 is used
147 times and was never being requested at all.

Latin and latin-ext subsets only. The unicode-range on each face means a page
of English text downloads just the latin file; latin-ext is there so an
accented character in a team name renders correctly rather than falling back.

Run when the weight list changes. Writes public/fonts/ and
public/assets/fbj-fonts.css.
"""
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "public", "fonts")
OUT_CSS = os.path.join(ROOT, "public", "assets", "fbj-fonts.css")

# Chrome UA, so Google serves woff2 rather than an older format.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

FAMILIES = {
    "DM Sans": "ital,wght@0,400;0,500;0,600;0,700;1,400",
    "Barlow Condensed": "wght@600;700;800;900",
    "Barlow": "wght@400;600",
    # The Storefront theme's own family. Used on a handful of theme-rendered
    # elements rather than throughout, but requested from Google on every page
    # regardless, so it costs a round trip either way.
    "Source Sans Pro": "ital,wght@0,300;0,400;0,600;0,700;0,900;1,400",
}
KEEP_SUBSETS = {"latin", "latin-ext"}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> int:
    os.makedirs(FONT_DIR, exist_ok=True)
    blocks, files = [], 0

    for family, spec in FAMILIES.items():
        css = fetch(
            "https://fonts.googleapis.com/css2?family="
            f"{family.replace(' ', '+')}:{spec}&display=swap"
        ).decode("utf-8")

        # Each @font-face is preceded by a /* subset */ comment.
        for subset, face in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{[^}]*\})", css):
            if subset not in KEEP_SUBSETS:
                continue
            url = re.search(r"src:\s*url\(([^)]+)\)", face).group(1)
            weight = re.search(r"font-weight:\s*(\d+)", face).group(1)
            style = re.search(r"font-style:\s*(\w+)", face).group(1)

            name = (f"{family.lower().replace(' ', '-')}-{weight}"
                    f"{'-italic' if style == 'italic' else ''}-{subset}.woff2")
            path = os.path.join(FONT_DIR, name)
            if not os.path.exists(path):
                with open(path, "wb") as fh:
                    fh.write(fetch(url))
            files += 1

            unicode_range = re.search(r"unicode-range:\s*([^;]+);", face).group(1)
            blocks.append(
                "@font-face {\n"
                f"  font-family: '{family}';\n"
                f"  font-style: {style};\n"
                f"  font-weight: {weight};\n"
                "  font-display: swap;\n"
                f"  src: url('/fonts/{name}') format('woff2');\n"
                f"  unicode-range: {unicode_range};\n"
                "}"
            )

    # Metric-matched fallbacks.
    #
    # Even preloaded, a webfont arrives after the first paint, and the text
    # reflows when it does. On the location pages that reflow was the entire
    # CLS score: the hero's fact chips rewrapped and the section under them
    # moved 21px.
    #
    # The size-adjust values are measured, not taken from a table -- the same
    # sample string rendered in each real face and in Arial at 100px, in the
    # browser. Arial runs 4-5% wider than Barlow at 400-500 and 9-10% wider at
    # 600-800, and a startling 25% wider than Barlow Condensed. A single
    # fallback face cannot vary its adjustment by weight, so each takes the
    # midpoint of its family's range; that leaves a worst case around 2% rather
    # than 25%, which is small enough not to change where a line wraps.
    fallbacks = """
@font-face {
  font-family: 'DM Sans Fallback';
  src: local('Arial'), local('Helvetica'), local('Liberation Sans');
  size-adjust: 102%;
  ascent-override: 96%;
  descent-override: 24%;
  line-gap-override: 0%;
}
@font-face {
  font-family: 'Barlow Fallback';
  src: local('Arial'), local('Helvetica'), local('Liberation Sans');
  size-adjust: 93%;
  ascent-override: 92%;
  descent-override: 24%;
  line-gap-override: 0%;
}
@font-face {
  font-family: 'Source Sans Fallback';
  src: local('Arial'), local('Helvetica'), local('Liberation Sans');
  size-adjust: 96%;
  ascent-override: 94%;
  descent-override: 26%;
  line-gap-override: 0%;
}
@font-face {
  font-family: 'Barlow Condensed Fallback';
  src: local('Arial Narrow'), local('Arial'), local('Helvetica'), local('Liberation Sans');
  size-adjust: 77%;
  ascent-override: 96%;
  descent-override: 25%;
  line-gap-override: 0%;
}"""

    header = (
        "/* Self-hosted Barlow and Barlow Condensed.\n"
        " *\n"
        " * Generated by scripts/build-fonts.py -- edit that, not this.\n"
        " *\n"
        " * These were fetched from Google on every page load, which is two DNS\n"
        " * lookups and two TLS handshakes before the first glyph exists. The fonts\n"
        " * arrived around four seconds in on a throttled connection and the hero\n"
        " * reflowed when they did, which was the whole of a 0.205 CLS score.\n"
        " *\n"
        " * Same-origin now, and the paths are stable, so the two faces that render\n"
        " * above the fold can be preloaded. Only the weights the site actually uses\n"
        " * are here; latin and latin-ext only.\n"
        " */\n"
    )
    with open(OUT_CSS, "w", encoding="utf-8") as fh:
        fh.write(header + fallbacks + "\n\n" + "\n".join(blocks) + "\n")

    total = sum(os.path.getsize(os.path.join(FONT_DIR, f)) for f in os.listdir(FONT_DIR))
    print(f"{files} faces, {len(os.listdir(FONT_DIR))} files, {total // 1024}KB -> public/fonts/")
    print(f"stylesheet -> {os.path.relpath(OUT_CSS, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
