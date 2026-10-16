"""Voice candidates: download the Higgsfield takes, check them with Whisper, and join each candidate's lines
into one listening reel (시안/voice/<candidate>.mp3).

usage: python tools/voice_reel.py
"""
import difflib
import re
import urllib.request
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[1]
TAKES = ROOT / 'assets' / 'src' / 'voice_takes'
REEL = ROOT / '시안' / 'voice'
CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_39vFtvjl9ehbIrEE19o2BU0lfz0/'
SR = 44100
GAP_S = 0.7
RMS_DB = -18

LINES = [
    ('open', 'はいどーも！クロライブの時間だぜ〜。今日はガチの廃病院、来ちゃいました！'),
    ('chat', 'え？ビビってる？ビビってねーし！余裕っしょ、余裕。'),
    ('donate', 'おっ、投げ銭あざーっす！もっと奥行けって？しゃーねーなぁ。'),
    ('listen', '今の音、なに？ちょ、みんな静かにして'),
    ('scared', 'やばい、やばいって、マジでなんかいる、早く逃げた方がいいかな'),
    ('panic', '無理無理無理！こっち見てる！見てるって！'),
    ('scream', 'うわああああああっ！来るな、来るなああっ！'),
    ('relief', 'はぁ、はぁ、セーフ、マジで死ぬかと思った'),
]
CANDIDATES = {
    'A_jasper': ['062901_5af6d533-7870-4e2e-b131-92ad1229936c', '062901_0352e0ae-ed21-4643-8779-335eca83ec1f',
                 '062901_36ab76f5-bd64-4aa6-9ab7-f1d9385ff51a', '062901_9f70b6d5-58ab-423f-9dd7-ba04d8d210d6',
                 '062901_93885673-621d-4802-abe7-8562b7e33fb9', '063509_b63f0730-b821-43f2-92df-d0391c8c0537',
                 '062901_c6e94ddf-9809-4215-b32e-e6e418eba0fb', '062901_4f3c6b27-1c6d-478c-b437-b3946d0054f6'],
    'B_kevin': ['062924_b41cc26a-4414-47df-8834-4a731b2ad8c0', '062924_d6e0ef05-1f84-499a-b7d9-60a87bd99f67',
                '062924_551ddc9c-56e5-4eeb-80ef-46c8b1d17bf6', '062924_d3fc238e-5521-4f54-b73c-4dd5e9c4fc50',
                '062924_5066f4b5-e230-412b-a0be-0c7005189dad', '063509_91fe22b0-3982-4285-9df5-64fa768252d4',
                '062924_26490c08-a829-4e64-a68b-85b9080d80fc', '062924_67fd59ca-18a7-43ae-8c26-3289ea48eb31'],
    'C_miles': ['062950_a702ade8-b841-44ca-a2bb-4d6f75ea662c', '063018_ed8f5447-470c-4678-a226-bed7aae6c36d',
                '062950_ea50496a-eee8-48d7-bfb0-80e2f2932286', '062950_36aa2a6b-fec5-44ef-8212-f7535c3c9689',
                '062951_32685d2c-2465-40de-abc8-edf9f301e47e', '062951_e270b8b3-55e6-4cf7-9529-9bf9edd0e5ef',
                '062951_bd91a309-275f-4565-a36f-f5fca1beb0ad', '062951_55716981-2367-4638-a97f-c542e594217c'],
}
strip = lambda s: re.sub(r"[\s、。！？!?…〜~ー・「」,.\[\]]", "", s)


def trim(y, floor_db=-40, pad_s=0.05):
    env = np.convolve(np.abs(y), np.ones(441) / 441, mode='same')
    on = np.flatnonzero(env > 10 ** (floor_db / 20) * np.abs(y).max())
    pad = int(SR * pad_s)
    return y[max(0, on[0] - pad):on[-1] + pad]


def main():
    REEL.mkdir(parents=True, exist_ok=True)
    whisper = WhisperModel('small', device='cpu', compute_type='int8')
    for cand, jobs in CANDIDATES.items():
        d = TAKES / cand
        d.mkdir(parents=True, exist_ok=True)
        parts = []
        print(cand)
        for (key, script), job in zip(LINES, jobs):
            f = d / f'{key}.mp3'
            if not f.exists():
                urllib.request.urlretrieve(f'{CDN}hf_20261016_{job}.mp3', f)
            y, _ = librosa.load(f, sr=SR, mono=True)
            heard = ''.join(s.text for s in whisper.transcribe(librosa.resample(y, orig_sr=SR, target_sr=16000), language='ja')[0])
            acc = difflib.SequenceMatcher(None, strip(script), strip(heard)).ratio()
            latin = re.findall(r'[A-Za-z]{3,}', heard)
            y = trim(y)
            print(f'  {key:7} {len(y) / SR:4.1f}s acc {acc:.2f}{"  LATIN " + str(latin) if latin else ""}  {heard}')
            parts += [y, np.zeros(int(SR * GAP_S))]
        # one gain per candidate: whispers stay quiet and screams stay loud, voices stay comparable
        reel = np.concatenate(parts)
        speech = reel[np.abs(reel) > 1e-3]
        reel = np.clip(reel * 10 ** (RMS_DB / 20) / np.sqrt((speech ** 2).mean()), -0.98, 0.98)
        sf.write(REEL / f'{cand}.mp3', reel.astype(np.float32), SR, format='MP3')
        print(f'  -> {cand}.mp3 {len(reel) / SR:.1f}s')


if __name__ == '__main__':
    main()
