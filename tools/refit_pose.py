"""Rescale a green-screen pose so its feet sit on a target floor line.

Keeps the creature's world scale consistent between Kling keyframes.

usage: python refit_pose.py src.png dst.png --floor 0.80 --scale 0.83
"""
import argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--floor", type=float, default=0.80)
ap.add_argument("--scale", type=float, default=0.83)
a = ap.parse_args()

im = Image.open(a.src).convert("RGB")
rgb = np.asarray(im).astype(np.int16)
green = rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])
fg = green < 60
rows = np.where(fg.mean(axis=1) > 0.002)[0]
cols = np.where(fg.mean(axis=0) > 0.002)[0]
top, bottom = rows[0], rows[-1]
cx = (cols[0] + cols[-1]) / 2
print("subject rows", top, bottom, "cx", cx)

W, H = im.size
fill = tuple(int(v) for v in np.median(rgb[:40, :40].reshape(-1, 3), axis=0))
small = im.resize((round(W * a.scale), round(H * a.scale)), Image.LANCZOS)
out = Image.new("RGB", (W, H), fill)
ox = round(W / 2 - cx * a.scale)
oy = round(a.floor * H - bottom * a.scale)
out.paste(small, (ox, oy))
out.save(a.dst)
print("wrote", a.dst, "offset", ox, oy, "fill", fill)
