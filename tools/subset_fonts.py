"""Subset the Google Fonts TTFs to the characters the POC actually uses -> assets/fonts/*.woff2.

Re-run after editing chat lines or UI text in poc/.
"""
import pathlib
import string

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "fonts" / "src"
OUT = ROOT / "assets" / "fonts"

text = "".join(p.read_text(encoding="utf-8") for p in (ROOT / "poc").glob("*.*") if p.suffix in (".html", ".js", ".css"))
ascii_set = string.printable + "·…—−×→✓●■"
all_chars = "".join(sorted(set(text) | set(ascii_set)))

FONTS = [
    ("ShipporiMinchoB1-Bold.ttf", "shippori-b1-bold.woff2", all_chars),
    ("ShipporiMinchoB1-ExtraBold.ttf", "shippori-b1-xbold.woff2", all_chars),
    ("DelaGothicOne-Regular.ttf", "dela-gothic-one.woff2", ascii_set),
    ("ZenKakuGothicNew-Medium.ttf", "zen-kaku-medium.woff2", all_chars),
    ("ZenKakuGothicNew-Bold.ttf", "zen-kaku-bold.woff2", all_chars),
]

for src, dst, chars in FONTS:
    font = TTFont(SRC / src)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    sub = subset.Subsetter(opts)
    sub.populate(text=chars)
    sub.subset(font)
    font.flavor = "woff2"
    font.save(OUT / dst)
    print(f"{dst}: {len(chars)} chars, {(OUT / dst).stat().st_size // 1024}KB")
