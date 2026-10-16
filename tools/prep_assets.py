"""Process Higgsfield source images into game-ready assets.

Outputs (relative to THE FOLLOWER/assets):
  locations/<id>/bg.webp (+ backdrop.webp)
  creatures/onryo/{crouch,stand,lunge}.webp
  hands/hands.webp + hands/hands.js     (screen hole rect for the phone canvas)
  chat/avatars.webp (4x4 sheet), chat/banknote.webp
  fx/logo.webp, fx/blood_0..5.webp, fx/drip.webp
  ui/*.webp + ui/ui.css                  (9-patch border-image rules)
  _debug/ui_slices.png                   (slice guides for review)

usage: python tools/prep_assets.py [--only ui,hands,...]
"""
import argparse
import json
import pathlib

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from keylib import alpha_bbox, fit_max, fit_width, greenness, keyed_rgba

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "src"
OUT = ROOT / "assets"


def save_webp(im, path, q=90):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)
    print(f"  {path.relative_to(OUT)}  {im.size[0]}x{im.size[1]}  {path.stat().st_size // 1024}KB")


def write_js(path, var, data):
    path.write_text(f"window.{var} = {json.dumps(data, ensure_ascii=False)};\n", encoding="utf-8")
    print(f"  {path.relative_to(OUT)}")


# location -> 9:16 bg source; a backdrop.png next to it becomes the 16:9 PC backdrop
LOCATIONS = {"haikyo": SRC / "bg_haikyo.png", "mori": SRC / "mori" / "bg.png", "byoin": SRC / "byoin" / "bg.png"}


def bg():
    for loc, src in LOCATIONS.items():
        im = Image.open(src).convert("RGB")
        save_webp(im.resize((1440, 2560), Image.LANCZOS), OUT / "locations" / loc / "bg.webp", 88)
        wide = src.parent / "backdrop.png"
        if loc != "haikyo" and wide.exists():
            im = Image.open(wide).convert("RGB")
            save_webp(im.resize((2560, 1448), Image.LANCZOS), OUT / "locations" / loc / "backdrop.webp", 80)


def creature():
    for name, src in (("crouch", "creature_crouch.png"), ("stand", "creature_stand_fit.png"),
                      ("lunge", "creature_lunge.png")):
        im = keyed_rgba(Image.open(SRC / src))
        save_webp(im.resize((760, 1344), Image.LANCZOS), OUT / "creatures" / "onryo" / f"{name}.webp")


def hands():
    im = Image.open(SRC / "hands_phone.png").convert("RGB")
    rgb = np.asarray(im)
    green = greenness(rgb) > 60
    lab, n = ndimage.label(green)
    H, W = green.shape
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    sizes = ndimage.sum(green, lab, range(1, n + 1))
    cand = [(s, i + 1) for i, s in enumerate(sizes) if (i + 1) not in border]
    _, sid = max(cand)
    m = lab == sid
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # corner radius: rows from the top until the hole reaches its left extent
    r = 0
    for y in range(y0, y1):
        if np.where(m[y])[0].min() <= x0 + 1:
            r = y - y0
            break
    rgba = keyed_rgba(im)
    save_webp(rgba, OUT / "hands" / "hands.webp", 90)
    data = {"src": "hands/hands.webp", "w": W, "h": H,
            "screen": {"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0), "r": int(r)}}
    write_js(OUT / "hands" / "hands.js", "HANDS", data)
    print("  screen", data["screen"])


def chat():
    im = Image.open(SRC / "avatars.png").convert("RGB")
    fg = greenness(np.asarray(im)) < 60
    lab, n = ndimage.label(ndimage.binary_opening(fg, iterations=2))
    objs = ndimage.find_objects(lab)
    boxes = [(sl[0].start, sl[1].start, sl[0].stop, sl[1].stop) for sl in objs
             if (sl[0].stop - sl[0].start) > 200 and (sl[1].stop - sl[1].start) > 200]
    boxes.sort(key=lambda b: (round(b[0] / 300), b[1]))
    assert len(boxes) == 16, len(boxes)
    cell = 128
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))
    rgba = keyed_rgba(im)
    for i, (y0, x0, y1, x1) in enumerate(boxes):
        c = rgba.crop((x0, y0, x1, y1)).resize((cell - 4, cell - 4), Image.LANCZOS)
        sheet.alpha_composite(c, ((i % 4) * cell + 2, (i // 4) * cell + 2))
    save_webp(sheet, OUT / "chat" / "avatars.webp", 90)

    note = keyed_rgba(Image.open(SRC / "banknote.png"))
    note = note.crop(alpha_bbox(note, pad=4))
    save_webp(fit_width(note, 256), OUT / "chat" / "banknote.webp", 90)


def fx():
    logo = keyed_rgba(Image.open(SRC / "logo.png"))
    logo = logo.crop(alpha_bbox(logo, pad=4))
    save_webp(fit_width(logo, 256), OUT / "fx" / "logo.webp", 92)

    sp = keyed_rgba(Image.open(SRC / "blood_splats.png"))
    cw, ch = sp.width // 3, sp.height // 2
    for i in range(6):
        c = sp.crop(((i % 3) * cw, (i // 3) * ch, (i % 3 + 1) * cw, (i // 3 + 1) * ch))
        c = c.crop(alpha_bbox(c, pad=6))
        save_webp(fit_max(c, 768), OUT / "fx" / f"blood_{i}.webp", 88)

    drip = keyed_rgba(Image.open(SRC / "blood_drip.png"))
    save_webp(drip.resize((1080, 1920), Image.LANCZOS), OUT / "fx" / "drip.webp", 88)


# name: (source, export width, slices [top, right, bottom, left] in exported px, use_9patch)
UI = {
    "panel":     ("ui_panel.png", 1040, [80, 116, 100, 28], True),
    "bet":       ("ui_bet.png", 520, [40, 200, 150, 40], True),
    "cashout":   ("ui_cashout.png", 520, [44, 175, 175, 44], True),
    "chip":      ("ui_chip.png", 320, [22, 26, 22, 26], True),
    "tab_on":    ("ui_tab_on.png", 520, [20, 70, 20, 70], True),
    "tab_off":   ("ui_tab_off.png", 520, [20, 26, 20, 26], True),
    "pill":      ("ui_pill.png", 200, [26, 32, 26, 32], True),
    "pill_hot":  ("ui_pill_hot.png", 220, [30, 44, 30, 44], True),
    "plate":     ("ui_plate.png", 520, [14, 60, 14, 60], True),
    "frame":     ("ui_icon_btn.png", 160, [40, 40, 40, 40], True),
    "superchat": ("ui_superchat.png", 420, [34, 40, 34, 40], True),
    "round":     ("ui_round.png", 112, None, False),
}


def solidify(im):
    """Fill semi-transparent holes inside the opaque body of a UI piece."""
    a = np.asarray(im).astype(np.float32)
    alpha = a[..., 3] / 255
    body = ndimage.binary_fill_holes(alpha > 0.85)
    body = ndimage.binary_erosion(body, iterations=2)
    hole = body & (alpha < 0.99)
    if hole.any():
        solid = body & (alpha >= 0.99)
        base = np.median(a[solid][:, :3], axis=0)
        k = alpha[hole][:, None]
        a[hole, :3] = a[hole, :3] * k + base * (1 - k)
        a[hole, 3] = 255
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def ui():
    css = ["/* generated by tools/prep_assets.py — 9-patch skins */",
           ".np{position:relative;isolation:isolate}",
           ".np::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;"
           "border-style:solid;border-color:transparent}"]
    dbg = []
    for name, (src, w, sl, nine) in UI.items():
        im = Image.open(SRC / src).convert("RGBA")
        im = im.crop(alpha_bbox(im, thresh=6, pad=2))
        im = solidify(fit_width(im, w))
        save_webp(im, OUT / "ui" / f"{name}.webp", 92)
        if not nine:
            continue
        t, r, b, l = sl
        css.append(
            f".np-{name}::before{{border-width:calc({t}px*var(--nps,1)) calc({r}px*var(--nps,1)) "
            f"calc({b}px*var(--nps,1)) calc({l}px*var(--nps,1));"
            f"border-image:url({name}.webp) {t} {r} {b} {l} fill / 1 stretch}}")
        g = Image.new("RGBA", im.size, (70, 74, 82, 255))
        g.alpha_composite(im)
        d = ImageDraw.Draw(g)
        for x in (l, im.width - r):
            d.line([(x, 0), (x, im.height)], fill=(0, 255, 255, 255), width=1)
        for y in (t, im.height - b):
            d.line([(0, y), (im.width, y)], fill=(0, 255, 255, 255), width=1)
        dbg.append((name, g))
    (OUT / "ui" / "ui.css").write_text("\n".join(css) + "\n", encoding="utf-8")
    print("  ui/ui.css")

    pad, colw = 12, 540
    rows = []
    y = pad
    for name, g in dbg:
        g = g if g.width <= colw else fit_width(g, colw)
        rows.append((name, g, y))
        y += g.height + 28
    sheet = Image.new("RGB", (colw * 2 + pad * 3, (y + 1) // 2 + 400), (30, 30, 34))
    d = ImageDraw.Draw(sheet)
    col_y = [pad, pad]
    for name, g, _ in rows:
        c = 0 if col_y[0] <= col_y[1] else 1
        x = pad + c * (colw + pad)
        sheet.paste(g.convert("RGB"), (x, col_y[c]))
        d.text((x, col_y[c] + g.height + 4), f"{name} {g.width}x{g.height}", fill=(255, 255, 255))
        col_y[c] += g.height + 28
    sheet = sheet.crop((0, 0, sheet.width, max(col_y) + pad))
    (OUT / "_debug").mkdir(exist_ok=True)
    sheet.save(OUT / "_debug" / "ui_slices.png")
    print("  _debug/ui_slices.png")


STEPS = {"bg": bg, "creature": creature, "hands": hands, "chat": chat, "fx": fx, "ui": ui}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    names = a.only.split(",") if a.only else list(STEPS)
    for n in names:
        print(n)
        STEPS[n]()
