"""Build release/TheFollower_POC/ and release/TheFollower_POC.zip for upload.

Static hosts serve the zip root, so the game itself is the root index.html, the zip has no
wrapping folder, entry paths always use forward slashes, and only web files go in.
"""
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'poc'
OUT = ROOT / 'release' / 'TheFollower_POC'
ZIP = ROOT / 'release' / 'TheFollower_POC.zip'

PAGES = ['index.html', 'style.css', 'content.js', 'slot.js', 'game.js']
# runtime assets only: sources, raw Kling clips, debug renders and full fonts stay behind
ASSET_DIRS = {
    'locations': None,
    'creatures': shutil.ignore_patterns('crouch.webp', 'stand.webp', 'lunge.webp'),
    'hands': None,
    'chat': None,
    'gifts': None,
    'slot': None,
    'fx': None,
    'ui': None,
    'audio': shutil.ignore_patterns('tick.mp3'),   # make_sfx.py still renders it; the game has no use for it
    'fonts': shutil.ignore_patterns('src'),
}
# media is already compressed; deflating it only costs time
STORED = {'.mp3', '.webp', '.woff2', '.bin'}
# Flux keeps only the first 1000 files of an upload and silently drops the rest
MAX_FILES = 1000


def pack_clips(creatures):
    """Turn each clip's frame folder into one file of back-to-back webps; clips.js gets their byte lengths."""
    for clips_js in sorted(creatures.glob('*/clips.js')):
        prefix, body = clips_js.read_text(encoding='utf-8').split('=', 1)
        data = json.loads(body.strip().rstrip(';'))
        for name, clip in data['clips'].items():
            blobs = [(clips_js.parent / name / f'{k:03d}.webp').read_bytes() for k in range(len(clip['frames']))]
            (clips_js.parent / f'{name}.bin').write_bytes(b''.join(blobs))
            clip['pack'] = [len(b) for b in blobs]
            shutil.rmtree(clips_js.parent / name)
        clips_js.write_text(f'{prefix.rstrip()} = {json.dumps(data, separators=(",", ":"))};\n', encoding='utf-8')


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    for name in PAGES:
        text = (SRC / name).read_text(encoding='utf-8')
        # poc/ sits one level below assets/; the release pages sit next to it
        text = text.replace('../assets/', 'assets/')
        assert '../' not in text, name
        (OUT / name).write_text(text, encoding='utf-8')
    for d, ignore in ASSET_DIRS.items():
        shutil.copytree(ROOT / 'assets' / d, OUT / 'assets' / d, ignore=ignore)
    pack_clips(OUT / 'assets' / 'creatures')

    ZIP.unlink(missing_ok=True)
    files = sorted(p for p in OUT.rglob('*') if p.is_file())
    assert len(files) < MAX_FILES, f'{len(files)} files: Flux drops everything past the first {MAX_FILES}'
    with zipfile.ZipFile(ZIP, 'w') as z:
        for p in files:
            method = zipfile.ZIP_STORED if p.suffix.lower() in STORED else zipfile.ZIP_DEFLATED
            z.write(p, p.relative_to(OUT).as_posix(), compress_type=method)
    print(f'{ZIP.name}: {len(files)} files, {ZIP.stat().st_size / 2**20:.1f} MB')


if __name__ == '__main__':
    main()
