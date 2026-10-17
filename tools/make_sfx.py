"""Synthesize THE FOLLOWER's horror sound set (no external sources).

One-shots -> assets/audio/<name>.mp3 (48 kHz mono, peak -1 dBFS)
Loops     -> assets/audio/<name>.wav (32 kHz mono, seamless, RMS-levelled)

usage: python tools/make_sfx.py [name ...]
"""
import pathlib
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, iirpeak, lfilter, resample_poly, sosfilt

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio"
SR = 48000
rng = np.random.default_rng(1307)


# ---------- primitives ----------
def n(d):
    return int(round(SR * d))


def tt(d):
    return np.arange(n(d)) / SR


def noise(d):
    return rng.standard_normal(n(d))


def _sos(kind, f, order=2):
    return butter(order, f, kind, fs=SR, output="sos")


def lp(x, f, order=2):
    return sosfilt(_sos("lowpass", f, order), x)


def hp(x, f, order=2):
    return sosfilt(_sos("highpass", f, order), x)


def bp(x, lo, hi, order=2):
    return sosfilt(_sos("bandpass", [lo, hi], order), x)


def peak(x, f, q):
    b, a = iirpeak(f, q, fs=SR)
    return lfilter(b, a, x)


def phase(freq):
    return 2 * np.pi * np.cumsum(freq) / SR


def saw(freq):
    p = np.cumsum(freq) / SR
    return 2 * (p % 1) - 1


def sine(freq):
    return np.sin(phase(freq))


def square(freq):
    return np.sign(np.sin(phase(freq)))


def expdec(d, rate):
    return np.exp(-tt(d) * rate)


def attack(d, a):
    return np.clip(tt(d) / max(a, 1e-4), 0, 1)


def place(dst, src, at, gain=1.0):
    i = n(at)
    j = min(len(dst), i + len(src))
    if j > i:
        dst[i:j] += src[: j - i] * gain
    return dst


def reverb(x, decay=1.8, mix=0.3, tone=5000, pre=0.012):
    ir_t = tt(decay)
    ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 6.9 / decay)
    ir = lp(ir, tone)
    ir = np.concatenate([np.zeros(n(pre)), ir])
    ir /= np.sqrt((ir ** 2).sum())
    wet = fftconvolve(x, ir)[: len(x) + len(ir)]
    dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
    return dry * (1 - mix) + wet * mix * 2.2


def drive(x, k):
    return np.tanh(x * k) / np.tanh(k)


def fade(x, a=0.002, r=0.02):
    x = x.copy()
    ia, ir = n(a), n(r)
    if ia:
        x[:ia] *= np.linspace(0, 1, ia)
    if ir:
        x[-ir:] *= np.linspace(1, 0, ir)
    return x


def trim(x, thresh=1e-3):
    idx = np.where(np.abs(x) > thresh * np.abs(x).max())[0]
    return x[: idx[-1] + 1] if len(idx) else x


def norm_peak(x, db=-1.0):
    return x * (10 ** (db / 20) / (np.abs(x).max() + 1e-9))


def norm_rms(x, db):
    y = x * (10 ** (db / 20) / (np.sqrt((x ** 2).mean()) + 1e-9))
    over = np.abs(y) > 0.85
    y[over] = np.sign(y[over]) * (0.85 + 0.15 * np.tanh((np.abs(y[over]) - 0.85) / 0.15))
    return y


def loopify(x, xfade):
    """Fold the last `xfade` seconds into the start so the buffer loops seamlessly."""
    k = n(xfade)
    body, tail = x[:-k].copy(), x[-k:]
    w = np.linspace(0, 1, k)
    body[:k] = body[:k] * np.sqrt(w) + tail * np.sqrt(1 - w)
    return body


# ---------- building blocks ----------
def thump(f0, f1, d, rate, click=0.15):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    s = np.sin(phase(f)) * np.exp(-t * rate) * attack(d, 0.003)
    c = lp(noise(d), 900) * np.exp(-t * 90) * click
    return s + c


def resonant_hit(d, freqs, q=12, rate=60, grit=0.0):
    t = tt(d)
    exc = noise(d) * np.exp(-t * 900)
    y = sum(peak(exc, f, q) for f in freqs)
    if grit:
        y += bp(noise(d), 1500, 7000) * np.exp(-t * rate * 1.5) * grit
    return y * np.exp(-t * rate)


def fm_bell(f, d, index=3.0, ratio=1.4, rate=3.5):
    t = tt(d)
    idx = index * np.exp(-t * 6)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * rate) * attack(d, 0.002)


VOWELS = {"a": (800, 1200), "i": (300, 2300), "u": (350, 800), "e": (450, 2000), "o": (500, 900)}


def formant(x, vowel, q=6):
    f1, f2 = VOWELS[vowel]
    return peak(x, f1, q) + 0.7 * peak(x, f2, q) + 0.25 * peak(x, 2600, q)


# ---------- sounds ----------
def heartbeat():
    d = 0.75
    y = np.zeros(n(d))
    place(y, thump(70, 42, 0.22, 16), 0.0, 1.0)
    place(y, thump(78, 46, 0.2, 18), 0.25, 0.72)
    y = drive(lp(y, 160, 4) * 3, 1.6)
    return fade(y, 0.001, 0.08)


def static(d, density=1.0, hum=0.18):
    t = tt(d)
    y = bp(noise(d), 600, 7500)
    gate = np.zeros(len(t))
    i = 0
    while i < len(t):
        seg = int(SR * rng.uniform(0.012, 0.06) / density)
        gate[i:i + seg] = rng.choice([0.08, 0.35, 0.7, 1.0], p=[0.2, 0.3, 0.3, 0.2])
        i += seg
    gate = lp(gate, 300)
    crackle = np.zeros(len(t))
    for _ in range(int(d * 90 * density)):
        crackle[rng.integers(0, len(t))] = rng.uniform(-1, 1) * 6
    crackle = hp(crackle, 1500)
    buzz = lp(square(np.full(len(t), 100.0)), 1800) * hum
    y = (y * gate + crackle * 0.4 + buzz * gate) * 0.6
    q = 2 ** -5
    y = np.round(y / q) * q
    return fade(y, 0.002, 0.04)


def sting():
    d = 2.6
    t = tt(d)
    y = np.zeros(len(t))
    for semi in (0, 1, 6, 7, 13):
        f = 880 * 2 ** (semi / 12) * 2 ** (rng.uniform(-4, 4) / 1200)
        vib = 1 + 0.006 * np.sin(2 * np.pi * rng.uniform(5.5, 7.5) * t + rng.uniform(0, 6))
        y += saw(f * vib)
    env = attack(d, 0.012) * (0.35 + 0.65 * np.exp(-t * 7)) * np.exp(-t * 1.1)
    y = bp(y, 500, 7000) * env * 0.25
    scrape = bp(noise(d), 2000, 6000) * (0.5 + 0.5 * np.sin(2 * np.pi * 19 * t)) * env * 0.35
    boom = thump(60, 32, 1.2, 3.5, click=0.4)
    y = y + scrape
    place(y, boom * 0.9, 0.0)
    return trim(reverb(y, 2.6, 0.35))


def crack():
    d = 0.55
    y = np.zeros(n(d))
    at = 0.0
    for _ in range(rng.integers(4, 7)):
        hit = resonant_hit(0.06, rng.choice([1700, 2300, 2900, 3600, 4200], 3, replace=False), q=9, rate=90)
        place(y, hit * rng.uniform(0.5, 1), at)
        at += rng.uniform(0.018, 0.07)
    place(y, thump(190, 120, 0.06, 60, click=0.6) * 0.6, 0.0)
    return trim(reverb(y, 0.7, 0.15))


def creak(d=1.6):
    t = tt(d)
    f = 70 + 40 * np.cumsum(rng.standard_normal(len(t))) / np.sqrt(len(t)) * 3
    f = np.clip(lp(f, 6), 35, 160)
    p = np.cumsum(f) / SR
    pulses = (np.diff(np.floor(p), prepend=0) > 0).astype(float)
    pulses *= rng.uniform(0.5, 1.0, len(t))
    y = peak(pulses, 650, 10) + peak(pulses, 1300, 14) * 0.8 + peak(pulses, 2150, 16) * 0.5
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7 * (0.6 + 0.4 * np.sin(2 * np.pi * 1.3 * t))
    return trim(reverb(y * env, 1.2, 0.3))


def whisper():
    d = 3.6
    y = np.zeros(n(d))
    at = 0.1
    while at < d - 0.4:
        sd = rng.uniform(0.11, 0.3)
        e = np.sin(np.pi * np.linspace(0, 1, n(sd))) ** 2
        src = noise(sd)
        if rng.random() < 0.25:
            syl = hp(src, 4500) * 0.6
        else:
            syl = formant(src, rng.choice(list(VOWELS)), q=7) * 0.5
        place(y, syl * e * rng.uniform(0.4, 1.0), at)
        at += sd + rng.uniform(0.02, 0.18)
    y = hp(y, 250)
    return trim(reverb(y, 2.2, 0.5, tone=6000))


def groan(d=2.4, f0=62, f1=92):
    t = tt(d)
    f = f0 + (f1 - f0) * (t / d) ** 1.5
    f = f * (1 + 0.04 * lp(rng.standard_normal(len(t)), 9) * 6)
    src = saw(f) + 0.6 * saw(f * 0.5) + 0.3 * saw(f * 1.01)
    vowel_mix = np.clip(t / d, 0, 1)
    y = formant(src, "o", 5) * (1 - vowel_mix) + formant(src, "a", 5) * vowel_mix
    trem = 0.7 + 0.3 * np.abs(lp(rng.standard_normal(len(t)), 7)) * 6
    env = attack(d, 0.25) * np.clip((d - t) / 0.5, 0, 1)
    return drive(y * trem * env * 0.25, 2.0)


def rise():
    d = 2.2
    y = np.zeros(n(d))
    place(y, groan(2.1) * 0.7, 0.05)
    for at in (0.08, 0.42, 0.8, 1.1, 1.5, 1.75):
        place(y, crack() * rng.uniform(0.5, 0.9), at)
    place(y, creak(1.4) * 0.5, 0.3)
    return trim(reverb(y, 1.4, 0.2))


def shriek():
    d = 2.1
    t = tt(d)
    ramp = np.clip(t / 0.28, 0, 1) ** 0.6
    f = 520 + 820 * ramp + 60 * np.sin(2 * np.pi * 9 * t) + 30 * lp(rng.standard_normal(len(t)), 30) * 8
    src = saw(f) + 0.7 * saw(f * 1.497) + 0.45 * saw(f * 1.26) + 0.5 * square(f * 0.5)
    src *= 0.75 + 0.25 * np.sin(2 * np.pi * 113 * t)
    y = peak(src, 1100, 6) + 0.9 * peak(src, 2400, 7) + 0.6 * peak(src, 3600, 8)
    breath = bp(noise(d), 2500, 7000) * 0.12
    env = attack(d, 0.03) * np.clip((d - t) / 0.45, 0, 1)
    y = drive((y * 0.22 + breath) * env, 1.8)
    return trim(reverb(y, 1.6, 0.25))


def run():
    d = 2.4
    y = np.zeros(n(d))
    at, k = 0.0, 0
    while at < d - 0.15:
        prog = at / d
        amp = 0.3 + 0.7 * prog ** 1.4
        step = lp(noise(0.05), 700) * expdec(0.05, 60) * 0.8
        slap = bp(noise(0.03), 1500, 4500) * expdec(0.03, 120) * 0.5
        place(y, step * amp, at)
        place(y, thump(95, 60, 0.08, 40, click=0.3) * amp, at)
        place(y, slap * amp, at + 0.004)
        at += 0.3 - 0.19 * prog ** 0.8 + rng.uniform(-0.015, 0.015)
        k += 1
    t = tt(d)
    sweep = np.zeros(len(t))
    w = noise(d)
    for i, (lo, hi) in enumerate(((300, 700), (600, 1400), (1200, 2600))):
        seg = bp(w, lo, hi) * np.clip((t / d - 0.45 - i * 0.15) / 0.2, 0, 1)
        sweep += seg
    y += sweep * 0.25
    return trim(reverb(y, 0.9, 0.18))


def impact():
    d = 1.8
    y = np.zeros(n(d))
    place(y, thump(70, 28, 1.6, 2.6, click=0.9) * 1.2, 0.0)
    crunch = bp(noise(0.25), 200, 3500) * expdec(0.25, 18)
    place(y, crunch, 0.0)
    glass = resonant_hit(0.5, [3900, 5300, 6800, 8100], q=30, rate=9, grit=0.6)
    place(y, glass * 0.5, 0.01)
    y = drive(y * 1.6, 2.2)
    return trim(reverb(y, 1.8, 0.3))


def phone_drop():
    d = 0.9
    y = np.zeros(n(d))
    for at, g in ((0.0, 1.0), (0.17, 0.55), (0.29, 0.35), (0.36, 0.2)):
        place(y, resonant_hit(0.12, [1900, 3150, 4700], q=24, rate=45) * g, at)
        place(y, thump(140, 90, 0.05, 70, click=0.5) * 0.5 * g, at)
    return trim(reverb(y, 0.6, 0.15))


def splat():
    d = 0.8
    y = np.zeros(n(d))
    for at, g in ((0.0, 1.0), (0.09, 0.6)):
        sd = 0.35
        t = tt(sd)
        src = noise(sd)
        out = np.zeros(len(t))
        cuts = 3800 * np.exp(-t * 12) + 250
        blk = 256
        for i in range(0, len(t), blk):
            out[i:i + blk] = lp(src[max(0, i - 2048):i + blk], cuts[i])[-len(src[i:i + blk]):]
        place(y, out * np.exp(-t * 9) * attack(sd, 0.002) * g, at)
    for _ in range(5):
        bd = rng.uniform(0.03, 0.06)
        bt = tt(bd)
        f0 = rng.uniform(250, 500)
        place(y, np.sin(phase(f0 * (1 + 2 * bt / bd))) * np.sin(np.pi * bt / bd) * 0.15, rng.uniform(0.1, 0.5))
    return trim(reverb(lp(y, 5000), 0.5, 0.15))


def signal_lost():
    d = 2.2
    t = tt(d)
    tone = np.sin(2 * np.pi * 1000 * t) * 0.35 * np.clip((t - 0.35) / 0.05, 0, 1)
    st = static(d, 1.4) * np.clip(1 - t / 0.6, 0.15, 1)
    return fade(tone + st, 0.002, 0.3)


def cashout():
    d = 2.0
    y = np.zeros(n(d))
    place(y, thump(95, 58, 0.7, 6, click=0.6) * 1.1, 0.0)
    for at, f in ((0.03, 587.3), (0.11, 880.0), (0.19, 1174.7), (0.27, 1760.0)):
        place(y, fm_bell(f, 1.5, index=2.4, ratio=2.0, rate=3.0) * 0.32, at)
    t = tt(1.2)
    shimmer = bp(noise(1.2), 6000, 11000) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t)) * np.exp(-t * 3.5) * 0.25
    place(y, shimmer, 0.05)
    return trim(reverb(y, 1.6, 0.28, tone=8000))


def donate():
    d = 0.9
    y = np.zeros(n(d))
    place(y, fm_bell(1318.5, 0.8, index=1.8, ratio=2.0, rate=5) * 0.5, 0.0)
    place(y, fm_bell(1975.5, 0.7, index=1.4, ratio=2.0, rate=6) * 0.4, 0.06)
    t = tt(0.4)
    place(y, bp(noise(0.4), 7000, 12000) * np.exp(-t * 10) * 0.2, 0.02)
    return trim(reverb(y, 1.0, 0.25, tone=9000))


def click():
    y = resonant_hit(0.12, [1450, 2950], q=16, rate=70) + lp(noise(0.12), 3000) * expdec(0.12, 400) * 0.3
    return fade(y, 0.0005, 0.02)


def tick():
    y = resonant_hit(0.09, [2300, 3400], q=18, rate=90)
    return fade(y * 0.6, 0.0005, 0.02)


def bet():
    d = 0.5
    y = np.zeros(n(d))
    place(y, thump(150, 85, 0.25, 14, click=0.8), 0.0)
    place(y, resonant_hit(0.15, [900, 1800], q=10, rate=40) * 0.6, 0.0)
    return trim(reverb(y, 0.7, 0.18))


# ---------- 除霊 bonus ----------
def koban():
    d = 1.0
    y = np.zeros(n(d))
    for at, g in ((0.0, 1.0), (0.07, 0.55), (0.12, 0.3)):
        place(y, resonant_hit(0.35, [2637, 3951, 5274, 7040], q=40, rate=14) * g, at)
    place(y, fm_bell(2093, 0.8, index=1.2, ratio=3.0, rate=5) * 0.35, 0.02)
    t = tt(0.5)
    place(y, bp(noise(0.5), 8000, 14000) * np.exp(-t * 12) * 0.15, 0.0)
    return trim(reverb(y, 0.9, 0.22, tone=9000))


def reel_spin():
    d = 0.5
    t = tt(d)
    y = bp(noise(d), 500, 3000) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5 * 0.45
    at = 0.0
    while at < d - 0.03:
        place(y, resonant_hit(0.03, [1800, 3100], q=14, rate=160) * 0.3, at)
        at += 0.022 + 0.03 * (at / d)
    return trim(reverb(y, 0.5, 0.12))


def reel_stop():
    d = 0.3
    y = np.zeros(n(d))
    place(y, resonant_hit(0.22, [880, 2090, 3270], q=18, rate=55), 0.0)
    place(y, thump(180, 115, 0.1, 50, click=0.6) * 0.7, 0.0)
    return trim(reverb(y, 0.4, 0.12))


def win_s():
    d = 1.0
    y = np.zeros(n(d))
    for i, f in enumerate((2637, 3136, 3520, 3136, 3951)):
        place(y, fm_bell(f * 2 ** (rng.uniform(-8, 8) / 1200), 0.6, index=1.6, ratio=2.4, rate=7) * 0.32, i * 0.045 + rng.uniform(0, 0.012))
    t = tt(0.6)
    place(y, bp(noise(0.6), 6000, 12000) * (0.5 + 0.5 * np.sin(2 * np.pi * 31 * t)) * np.exp(-t * 6) * 0.2, 0.0)
    return trim(reverb(y, 1.1, 0.25, tone=9000))


def win_big():
    d = 2.0
    y = np.zeros(n(d))
    place(y, thump(88, 44, 1.4, 3.6, click=0.7) * 1.2, 0.0)
    place(y, lp(noise(0.3), 500) * expdec(0.3, 14) * 0.5, 0.0)
    for i, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0, 2637.0)):
        place(y, fm_bell(f, 1.5, index=2.2, ratio=2.0, rate=3.2) * 0.26, 0.04 + i * 0.06)
    place(y, win_s() * 0.6, 0.3)
    return trim(reverb(y, 1.8, 0.3, tone=8000))


def hit():
    """a talisman slaps into the ghost: paper whip, a holy zap, the thing hisses"""
    d = 0.7
    t = tt(d)
    y = np.zeros(len(t))
    sw = 0.12
    st = tt(sw)
    whip = bp(noise(sw), 1200, 6000) * np.sin(np.pi * st / sw) ** 2 * 0.6
    place(y, whip, 0.0)
    zd = 0.28
    zt = tt(zd)
    zap = saw(2200 * np.exp(-zt * 9) + 260) * np.exp(-zt * 11) * 0.35
    place(y, bp(zap, 300, 7000), 0.09)
    place(y, thump(130, 70, 0.3, 16, click=0.8) * 0.9, 0.1)
    hd = 0.5
    ht = tt(hd)
    place(y, hp(noise(hd), 4000) * np.exp(-ht * 7) * 0.22, 0.12)
    return trim(reverb(drive(y * 1.3, 1.6), 0.8, 0.2))


def exorcise():
    """the light builds, the drum lands, the ghost burns away screaming into nothing"""
    d = 3.4
    y = np.zeros(n(d))
    bd = 1.0
    bt = tt(bd)
    build = bp(noise(bd), 800, 9000) * (bt / bd) ** 2 * 0.35
    for f in (1046.5, 1568.0, 2093.0):
        build += np.sin(2 * np.pi * f * bt * (1 + 0.04 * bt)) * (bt / bd) ** 3 * 0.08
    place(y, build, 0.0)
    place(y, thump(70, 30, 2.2, 2.2, click=1.0) * 1.4, bd)
    place(y, impact() * 0.5, bd)
    for i, f in enumerate((523.3, 659.3, 784.0, 1046.5, 1318.5)):
        place(y, fm_bell(f, 2.3, index=2.6, ratio=2.76, rate=1.6) * 0.22, bd + 0.02 + i * 0.03)
    wd = 1.8
    wt = tt(wd)
    f = 980 * np.exp(-wt * 1.6) + 140
    src = saw(f) + 0.6 * saw(f * 1.5)
    wail = (peak(src, 900, 6) + 0.8 * peak(src, 2200, 7)) * np.exp(-wt * 2.2) * attack(wd, 0.04) * 0.14
    place(y, drive(wail, 1.6), bd + 0.05)
    for at in (bd + 0.1, bd + 0.35, bd + 0.7):
        place(y, crack() * 0.4, at)
    return trim(reverb(y, 2.6, 0.32, tone=7000))


def stamp():
    d = 0.5
    y = np.zeros(n(d))
    place(y, thump(115, 60, 0.35, 12, click=1.0) * 1.1, 0.0)
    place(y, bp(noise(0.12), 400, 3000) * expdec(0.12, 40) * 0.5, 0.0)
    return trim(reverb(y, 0.6, 0.15))


def bonus_in():
    """a temple rin struck once, the room swelling under it"""
    d = 3.0
    y = np.zeros(n(d))
    place(y, fm_bell(740, 3.0, index=1.4, ratio=2.76, rate=1.1) * 0.5, 0.0)
    place(y, fm_bell(1110, 2.4, index=1.0, ratio=2.76, rate=1.6) * 0.22, 0.0)
    t = tt(d)
    swell = np.sin(2 * np.pi * 55 * t) * np.sin(np.pi * np.clip(t / d, 0, 1)) * 0.25
    y += swell
    place(y, thump(80, 46, 1.0, 4, click=0.4) * 0.7, 0.0)
    return trim(reverb(y, 2.4, 0.3))


def bonus_loop():
    """taiko under the bonus: 4 bars at 120 bpm, the last one a roll"""
    beat = 0.5
    d, xf = 16 * beat, 1.0
    y = np.zeros(n(d + xf))

    def don(g):
        body = thump(92, 52, 0.7, 5.5, click=0.45)
        place(body, lp(noise(0.12), 420) * expdec(0.12, 30) * 0.4, 0.0)
        return body * g

    def ka(g):
        return resonant_hit(0.09, [1180, 2470], q=9, rate=70) * g

    for bar in range(4):
        b0 = bar * 4 * beat
        hits = [(0, don, 1.0), (1.5, don, 0.6), (2, don, 0.85), (3, ka, 0.5), (3.5, ka, 0.4)]
        if bar == 3:
            hits = [(0, don, 1.0), (1.5, don, 0.6), (2, don, 0.85), (2.5, ka, 0.4), (3, don, 0.7), (3.25, don, 0.55), (3.5, don, 0.75), (3.75, don, 0.9)]
        for at, fn, g in hits:
            place(y, fn(g), b0 + at * beat)
    t = tt(d + xf)
    y += np.sin(2 * np.pi * 41.2 * t) * (0.18 + 0.06 * np.sin(2 * np.pi * t / d)) + saw(np.full(len(t), 82.4)) * 0.02
    shaker = np.zeros(len(t))
    for k in range(int((d + xf) / (beat / 2))):
        place(shaker, hp(noise(0.05), 6000) * expdec(0.05, 70) * (0.12 if k % 2 else 0.06), k * beat / 2)
    y += shaker
    y = reverb(y, 1.4, 0.2)[: len(t)]
    return loopify(y, xf)


def drone_loop():
    d, xf = 16.0, 3.0
    total = d + xf
    t = tt(total)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * t / total * 2)
    base = saw(np.full(len(t), 41.2)) + saw(np.full(len(t), 41.55)) + 0.6 * saw(np.full(len(t), 61.74))
    cut = 140 + 180 * lfo
    out = np.zeros(len(t))
    blk = 1024
    for i in range(0, len(t), blk):
        seg = base[max(0, i - 4096):i + blk]
        out[i:i + blk] = lp(seg, cut[i])[-len(base[i:i + blk]):]
    y = out * 0.5 + np.sin(2 * np.pi * 41.2 * t) * 0.35
    swell = sum(np.sin(2 * np.pi * t / total * k + rng.uniform(0, 6)) for k in (3, 5, 7)) / 3
    wind = bp(noise(total), 220, 900) * (0.45 + 0.35 * swell) * 0.5
    y += wind
    for _ in range(int(total * 0.5)):
        f = rng.uniform(1400, 2600)
        bd = 0.06
        bt = tt(bd)
        drip = np.sin(phase(f * (1 + 0.6 * bt / bd))) * np.exp(-bt * 70) * 0.12
        place(y, drip, rng.uniform(0, total - 0.1))
    for at in rng.uniform(0, total - 3, 3):
        mt = tt(2.5)
        groanm = (peak(lp(noise(2.5), 600), 310, 30) + peak(noise(2.5) * 0.3, 470, 40)) * np.sin(np.pi * mt / 2.5) * 0.25
        place(y, groanm, at)
    y = reverb(y, 3.0, 0.3, tone=3000)[: len(t)]
    return loopify(y, xf)


def tension_loop():
    d, xf = 8.0, 2.0
    total = d + xf
    t = tt(total)
    y = np.zeros(len(t))
    for f in (659.3, 698.5, 987.8, 1046.5):
        vib = 1 + 0.005 * np.sin(2 * np.pi * rng.uniform(4.8, 6.2) * t + rng.uniform(0, 6))
        y += saw(f * vib * 2 ** (rng.uniform(-6, 6) / 1200))
    trem = 0.65 + 0.35 * np.sin(2 * np.pi * 5.3 * t)
    y = bp(y, 450, 4200) * trem * 0.18
    pulse = np.zeros(len(t))
    for at in np.arange(0, total, 1.0):
        place(pulse, thump(55, 38, 0.6, 7, click=0.1) * 0.5, at)
    y += pulse
    y = reverb(y, 2.4, 0.35)[: len(t)]
    return loopify(y, xf)


def breath_loop():
    d, xf = 4.4, 0.4
    total = d + xf
    y = np.zeros(n(total))
    at = 0.0
    while at < total - 0.4:
        for kind, sd, g in (("in", 0.32, 0.8), ("out", 0.28, 1.0)):
            e = np.sin(np.pi * np.linspace(0, 1, n(sd))) ** 1.5
            src = noise(sd)
            s = formant(src, "a" if kind == "out" else "e", q=3) * 0.4 + hp(src, 3000) * 0.25
            place(y, s * e * g * rng.uniform(0.8, 1.0), at)
            at += sd + rng.uniform(0.02, 0.06)
    y = reverb(hp(y, 300), 0.6, 0.15)[: n(total)]
    return loopify(y, xf)


ONESHOTS = {
    "heartbeat": heartbeat,
    "static_s": lambda: static(0.35, 1.4),
    "static_m": lambda: static(0.8),
    "static_l": lambda: static(1.6, 0.8),
    "sting": sting,
    "crack": crack,
    "creak": creak,
    "whisper": whisper,
    "rise": rise,
    "shriek": shriek,
    "run": run,
    "impact": impact,
    "phone_drop": phone_drop,
    "splat": splat,
    "signal_lost": signal_lost,
    "cashout": cashout,
    "donate": donate,
    "click": click,
    "tick": tick,
    "bet": bet,
    "koban": koban,
    "reel_spin": reel_spin,
    "reel_stop": reel_stop,
    "win_s": win_s,
    "win_big": win_big,
    "hit": hit,
    "exorcise": exorcise,
    "stamp": stamp,
    "bonus_in": bonus_in,
}
LOOPS = {
    "drone_loop": (drone_loop, -20),
    "tension_loop": (tension_loop, -22),
    "breath_loop": (breath_loop, -24),
    "bonus_loop": (bonus_loop, -21),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    want = set(sys.argv[1:])
    for name, fn in ONESHOTS.items():
        if want and name not in want:
            continue
        y = norm_peak(fade(fn(), 0.0005, 0.03), -1.0)
        p = OUT / f"{name}.mp3"
        sf.write(p, y.astype(np.float32), SR, format="MP3")
        print(f"{name}.mp3  {len(y) / SR:.2f}s  {p.stat().st_size // 1024}KB")
    for name, (fn, rms) in LOOPS.items():
        if want and name not in want:
            continue
        y = norm_rms(fn(), rms)
        y = resample_poly(y, 2, 3)
        p = OUT / f"{name}.wav"
        sf.write(p, y.astype(np.float32), 32000, subtype="PCM_16")
        print(f"{name}.wav  {len(y) / 32000:.2f}s  {p.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
