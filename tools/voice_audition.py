"""Score TTS voice auditions: speaking pitch, pitch range, scream lift, and how well Whisper hears the script.

usage: python tools/voice_audition.py <dir of mp3> "<script text>"
"""
import difflib
import re
import sys
from pathlib import Path

import librosa
import numpy as np
from faster_whisper import WhisperModel

src = Path(sys.argv[1])
script = sys.argv[2]
strip = lambda s: re.sub(r"[\s、。！？!?…〜~ー・「」,.\[\]a-zA-Z]", "", s)
model = WhisperModel("small", device="cpu", compute_type="int8")

rows = []
for f in sorted(src.glob("*.mp3")):
    y, sr = librosa.load(f, sr=16000, mono=True)
    f0, voiced, _ = librosa.pyin(y, fmin=70, fmax=600, sr=sr, frame_length=1024)
    f0 = f0[voiced & ~np.isnan(f0)]
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]
    loud = 20 * np.log10(np.percentile(rms, 99) / (np.median(rms[rms > rms.max() * 0.05]) + 1e-9))
    segs, _ = model.transcribe(y.astype(np.float32), language="ja", beam_size=5)
    text = "".join(s.text for s in segs)
    acc = difflib.SequenceMatcher(None, strip(script), strip(text)).ratio()
    rows.append((f.stem, len(y) / sr, np.median(f0), np.percentile(f0, 90) / np.percentile(f0, 10), loud, acc, text))

print(f"{'voice':12} {'sec':>5} {'F0':>5} {'range':>6} {'lift':>5} {'acc':>5}  heard")
for r in rows:
    print(f"{r[0]:12} {r[1]:5.1f} {r[2]:5.0f} {r[3]:6.2f} {r[4]:5.1f} {r[5]:5.2f}  {r[6]}")
