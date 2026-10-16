"""Kling green-screen clips -> per-frame cropped WebP + JS manifest.

Each frame is cropped to its own alpha bbox; the manifest stores the crop rect
in source-video pixels so the game can place frames exactly.

usage: python tools/key_clips.py [creature] [--only idle,charge]
"""
import argparse
import json
import pathlib
import shutil

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

from keylib import key

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# creature id -> clip name -> settings
CREATURES = {
    "onryo": {
        "idle":        {"fps": 12, "scale": 0.5,  "loop": True, "drop_last": True},
        "tense_head":  {"fps": 12, "scale": 0.5},
        "tense_reach": {"fps": 12, "scale": 0.5},
        "rise":        {"fps": 15, "scale": 0.5},
        "charge":      {"fps": 24, "scale": 0.75},
    },
    "kaisou": {
        "idle":        {"fps": 12, "scale": 0.5,  "loop": True, "drop_last": True},
        "tense_twist": {"fps": 12, "scale": 0.5},
        "tense_neck":  {"fps": 12, "scale": 0.5},
        "rise":        {"fps": 15, "scale": 0.5},
        "charge":      {"fps": 24, "scale": 0.75},
    },
    "kanja": {
        "idle":        {"fps": 12, "scale": 0.5,  "loop": True, "drop_last": True},
        "tense_snap":  {"fps": 15, "scale": 0.5},
        "tense_crawl": {"fps": 12, "scale": 0.5},
        "rise":        {"fps": 15, "scale": 0.5},
        "charge":      {"fps": 24, "scale": 0.75},
    },
}

MIN_BLOB = 400       # px at source resolution; smaller islands are compression specks
QUALITY = 82


def clean_alpha(a):
    solid = a > 0.35
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = np.isin(lab, np.where(sizes >= MIN_BLOB)[0] + 1)
    else:
        keep = solid
    keep = ndimage.binary_dilation(keep, iterations=3)
    a = np.where(keep, a, 0)
    a[a < 0.06] = 0
    return a


def process(cid, name, cfg):
    src = ASSETS / "kling" / cid / f"{name}.mp4"
    if not src.exists():   # the first creature's clips sit directly in kling/
        src = ASSETS / "kling" / f"{name}.mp4"
    out_dir = ASSETS / "creatures" / cid / name
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    cap = cv2.VideoCapture(str(src))
    vfps = cap.get(cv2.CAP_PROP_FPS)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if cfg.get("drop_last"):
        total -= 1
    n_out = max(1, round(total * cfg["fps"] / vfps))
    want = [min(total - 1, round(i * vfps / cfg["fps"])) for i in range(n_out)]
    frames, idx, k, size = [], 0, 0, 0
    s = cfg["scale"]
    while k < len(want):
        ok, f = cap.read()
        if not ok:
            break
        if idx == want[k]:
            rgb, a = key(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
            a = clean_alpha(a)
            ys, xs = np.where(a > 0.02)
            if len(xs):
                x0, y0 = max(0, xs.min() - 2), max(0, ys.min() - 2)
                x1, y1 = min(W, xs.max() + 3), min(H, ys.max() + 3)
            else:
                x0, y0, x1, y1 = 0, 0, 2, 2
            rgba = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)[y0:y1, x0:x1]
            im = Image.fromarray(rgba, "RGBA")
            ow, oh = max(1, round((x1 - x0) * s)), max(1, round((y1 - y0) * s))
            im = im.resize((ow, oh), Image.LANCZOS)
            p = out_dir / f"{len(frames):03d}.webp"
            im.save(p, "WEBP", quality=QUALITY, method=5)
            size += p.stat().st_size
            frames.append([int(x0), int(y0), int(x1 - x0), int(y1 - y0)])
            while k < len(want) and want[k] == idx:
                k += 1
        idx += 1
    cap.release()
    print(f"  {name}: {len(frames)} frames @ {cfg['fps']}fps  {size // 1024}KB")
    return {"fps": cfg["fps"], "loop": bool(cfg.get("loop")), "frames": frames}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("creature", nargs="?", default="onryo")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    cid = a.creature
    man_path = ASSETS / "creatures" / cid / "clips.js"
    data = {"frameW": 1080, "frameH": 1912, "clips": {}}
    if man_path.exists():
        txt = man_path.read_text(encoding="utf-8")
        data = json.loads(txt[txt.index("=") + 1:].strip().rstrip(";"))
    names = a.only.split(",") if a.only else list(CREATURES[cid])
    for n in names:
        data["clips"][n] = process(cid, n, CREATURES[cid][n])
    var = "CLIPS_" + cid
    man_path.write_text(f"window.{var} = {json.dumps(data, separators=(',', ':'))};\n", encoding="utf-8")
    print("  wrote", man_path.relative_to(ASSETS))


if __name__ == "__main__":
    main()
