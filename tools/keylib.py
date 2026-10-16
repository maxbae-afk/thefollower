"""Shared chroma-key helpers for THE FOLLOWER asset pipeline."""
import numpy as np
from PIL import Image

KEY_LO, KEY_HI = 30, 90


def greenness(rgb):
    rgb = rgb.astype(np.float32)
    return rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])


def key(rgb, lo=KEY_LO, hi=KEY_HI):
    """Green-screen key with despill. Returns float RGB and alpha in 0..1."""
    rgb = rgb.astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = g - np.maximum(r, b)
    alpha = np.clip((hi - green) / (hi - lo), 0, 1)
    rgb[..., 1] = np.where(green > 0, np.maximum(r, b), g)
    return rgb, alpha


def keyed_rgba(im, lo=KEY_LO, hi=KEY_HI):
    rgb, a = key(np.asarray(im.convert("RGB")), lo, hi)
    out = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def alpha_bbox(im, thresh=8, pad=0):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > thresh)
    if not len(xs):
        return (0, 0, im.width, im.height)
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(im.width, xs.max() + 1 + pad), min(im.height, ys.max() + 1 + pad)
    return (int(x0), int(y0), int(x1), int(y1))


def fit_width(im, w):
    if im.width == w:
        return im
    return im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)


def fit_max(im, m):
    s = m / max(im.size)
    if s >= 1:
        return im
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
