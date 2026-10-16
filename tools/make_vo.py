"""Streamer voice: Higgsfield takes (assets/src/vo_raw/) -> game files (assets/audio/vo/<key>.mp3).

Downloads any missing take, checks each with Whisper (script match, no direction tags read aloud),
then trims, rolls off rumble, adds a short corridor tail and levels each deck to its own loudness.

usage: python tools/make_vo.py [--no-check]
"""
import difflib
import re
import shutil
import sys
import urllib.request

import librosa
import numpy as np
import soundfile as sf

from make_sfx import ROOT, SR, fade, hp, lp, reverb
from vo_lines import LINES, REUSED

RAW = ROOT / 'assets' / 'src' / 'vo_raw'
OUT = ROOT / 'assets' / 'audio' / 'vo'
TAKES = ROOT / 'assets' / 'src' / 'voice_takes' / 'C_miles'
CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_39vFtvjl9ehbIrEE19o2BU0lfz0/hf_20261016_'
JOBS = {
    'ready_1': '074743_acf8b3e4-62d5-41e6-8bff-332420bdb3a7', 'ready_2': '074743_2716c13d-6d34-4d0e-b4da-0b24728870b5',
    'ready_3': '075500_13baccc9-db2c-49da-bdd8-14b4a915cfd2', 'ready_4': '074743_e304abd4-66f0-4111-80bf-2cab5314b06a',
    'open_2': '074743_ec0cdd96-46f0-4755-a3c8-ed8bea5d6e84', 'open_3': '074743_d1071525-1304-4545-9423-04a5ced51014',
    'early_2': '074744_7880f160-d20d-42a3-a2e1-353b78a834a2', 'early_3': '074743_15f1184f-8893-44c1-b646-495ff6e50865',
    'early_4': '075459_0d0ca799-f710-43fd-b101-2134afec2ece', 'early_5': '074822_a899ab36-da1f-4b1f-b3c9-f2f97578b29e',
    'donate_2': '074822_7e50d8d3-40eb-41ba-9e08-ffab3c74ac27', 'donate_3': '074822_46071403-8c53-402d-8776-f0ab672fdb8e',
    'mid_2': '074823_614b5b12-3aa3-4e8d-b714-65e05773303f', 'mid_3': '075459_27d2814a-4ccd-40e3-84c7-8730001577f5',
    'mid_4': '074822_328d6ffd-94a1-46c8-a7d1-d13a3c36ba01', 'mid_5': '074823_c7b5b49e-2a18-40c8-9b6a-a1582d50ebd1',
    'late_2': '074822_ca76fc5f-f9b5-47b8-aafa-17a20119794e', 'late_3': '074822_70caf925-5c91-4175-b3dd-cad17b6bf39c',
    'late_4': '074856_1a6fbbd4-02e7-4816-b3d2-0c8f2f428c3d', 'late_5': '074856_5681a250-df10-4f7f-b7ba-e55acb2b0754',
    'late_6': '074856_97a6c592-d958-4883-8b16-1975fd7d696b', 'fake_face_2': '074856_0e8c3091-44cd-4749-98d1-8165110958db',
    'fake_hand_1': '075500_6959e5d6-af6e-4583-ba68-8b3728bf9271', 'fake_glitch_1': '080343_e6ae76fb-d2f0-406a-9260-5cfbcaedf7fa',
    'fake_hand_2': '080826_af9ba332-66f2-4c6a-8f31-8f89f4cab2f1', 'fake_glitch_2': '080826_1a88c66e-0d1b-4e68-8ee9-6e2949d32b80',
    'fake_any_1': '074856_86385e0a-2dba-4338-9066-196e67c3ab94', 'fake_any_2': '074856_0a87503b-2da7-41ca-ad98-d78f27f5158f',
    'escape_2': '075500_4fbbcb4a-70de-48cd-8f1e-e7ced641c443', 'escape_3': '074929_c307a497-349f-4b3b-93d7-dad912787047',
    'escape_4': '074929_6e32c9de-4e20-4a75-96ae-ab89e948262a', 'scream_2': '080347_43f70b96-9843-40c8-85cd-affbcd964716',
    'scream_3': '074930_9b6d69e6-b5a1-417b-9087-9eb29ef61bf3', 'scream_4': '074930_92ef630b-ca74-4447-b6b4-5d343884713c',
    'close_1': '074929_a55f90da-b042-4bb1-9f81-ff39125edb61', 'close_2': '074929_e8bd58f3-aed2-46d0-b008-1549ed74c15e',
    'open_1': '085822_741f9b86-04c0-431c-b35c-8867bf571a33', 'open_4': '085822_14cf64da-90c8-4856-a902-06f655674746',
    'early_6': '085822_1f5e79ae-0ea6-4240-a806-5af0c81e3218', 'open_5': '085822_dd035e6d-5016-4f0a-ac6a-8bfa04a1d32b',
    'early_7': '085822_40183cf6-9c9e-42ea-be14-65ea5c8bd16b', 'fake_neck_1': '085822_5e318cdc-7262-43bd-a02c-551ed4fa5a80',
    'fake_crawl_1': '085823_903570e2-c3ad-49aa-8479-33069e7e1303', 'climb_1': '085822_9aaf7073-ed96-492e-b713-5e914fb478de',
    'climb_2': '085823_480c4c06-1822-42cd-8b19-cde303195696', 'retreat_1': '085823_600457d5-af08-41f4-8f27-6b5899ae46bc',
}
# RMS of the voiced part per deck: nervous mutters sit under the room, screams on top of it
DECK_DB = {'ready': -19, 'open': -18, 'early': -18, 'donate': -18, 'mid': -21, 'late': -20,
           'fake': -17, 'escape': -17, 'scream': -14, 'close': -21, 'climb': -19, 'retreat': -20}
strip = lambda s: re.sub(r'[\s、。！？!?…〜~ー・「」,.\[\]]', '', s)


def deck(key):
    return key.split('_')[0]


def fetch():
    RAW.mkdir(parents=True, exist_ok=True)
    for key in LINES:
        f = RAW / f'{key}.mp3'
        if f.exists():
            continue
        if key in REUSED:
            shutil.copy2(TAKES / f'{REUSED[key]}.mp3', f)
        else:
            urllib.request.urlretrieve(f'{CDN}{JOBS[key]}.mp3', f)


def check():
    from faster_whisper import WhisperModel
    model = WhisperModel('small', device='cpu', compute_type='int8')
    for key, line in LINES.items():
        y, _ = librosa.load(RAW / f'{key}.mp3', sr=16000, mono=True)
        heard = ''.join(s.text for s in model.transcribe(y, language='ja', beam_size=5)[0])
        script = re.sub(r'^\[[^\]]*\]\s*', '', line)
        acc = difflib.SequenceMatcher(None, strip(script), strip(heard)).ratio()
        latin = re.findall(r'[A-Za-z]{3,}', heard)
        flag = '  <-- check' if acc < 0.7 or latin else ''
        print(f'{key:14} acc {acc:.2f}  {heard}{flag}')


def level(y, db):
    env = np.sqrt(np.convolve(y ** 2, np.ones(SR // 50) / (SR // 50), mode='same'))
    voiced = y[env > env.max() * 0.08]
    y = y * 10 ** (db / 20) / (np.sqrt((voiced ** 2).mean()) + 1e-9)
    over = np.abs(y) > 0.8
    y[over] = np.sign(y[over]) * (0.8 + 0.18 * np.tanh((np.abs(y[over]) - 0.8) / 0.18))
    return y


def process():
    OUT.mkdir(parents=True, exist_ok=True)
    for key in LINES:
        y, _ = librosa.load(RAW / f'{key}.mp3', sr=SR, mono=True)
        env = np.convolve(np.abs(y), np.ones(SR // 100) / (SR // 100), mode='same')
        on = np.flatnonzero(env > env.max() * 0.02)
        y = y[max(0, on[0] - SR // 50):on[-1] + SR // 10]
        y = lp(hp(y, 90), 11000)
        y = reverb(y, decay=0.7, mix=0.1, tone=3800, pre=0.008)
        y = fade(level(y, DECK_DB[deck(key)]), a=0.004, r=0.12)
        sf.write(OUT / f'{key}.mp3', y.astype(np.float32), SR, format='MP3')
        print(f'{key:14} {len(y) / SR:4.1f}s  peak {20 * np.log10(np.abs(y).max()):5.1f} dBFS')


if __name__ == '__main__':
    fetch()
    if '--no-check' not in sys.argv:
        check()
    process()
