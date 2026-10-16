"""Build release/TheFollower_POC/ and release/TheFollower_POC.zip for upload.

Static hosts serve the zip root, so the game itself is the root index.html, the zip has no
wrapping folder, and entry paths always use forward slashes.
"""
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'poc'
OUT = ROOT / 'release' / 'TheFollower_POC'
ZIP = ROOT / 'release' / 'TheFollower_POC.zip'

PAGES = ['index.html', 'style.css', 'content.js', 'game.js']
# runtime assets only: sources, raw Kling clips, debug renders and full fonts stay behind
ASSET_DIRS = {
    'locations': None,
    'creatures': shutil.ignore_patterns('crouch.webp', 'stand.webp', 'lunge.webp'),
    'hands': None,
    'chat': None,
    'fx': None,
    'ui': None,
    'audio': None,
    'fonts': shutil.ignore_patterns('src'),
}
# media is already compressed; deflating it only costs time
STORED = {'.mp3', '.webp', '.woff2'}

# the game decodes audio through fetch, so it needs http rather than file://
RUN_BAT = r'''@echo off
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8770/
  python -m http.server 8770 --bind 127.0.0.1
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8770/
  py -m http.server 8770 --bind 127.0.0.1
  goto :eof
)

echo Python is required to run this locally. Upload the folder to a web host instead.
pause
'''


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
    (OUT / 'run-poc.bat').write_text(RUN_BAT.replace('\n', '\r\n'), encoding='ascii', newline='')

    ZIP.unlink(missing_ok=True)
    files = sorted(p for p in OUT.rglob('*') if p.is_file())
    with zipfile.ZipFile(ZIP, 'w') as z:
        for p in files:
            method = zipfile.ZIP_STORED if p.suffix.lower() in STORED else zipfile.ZIP_DEFLATED
            z.write(p, p.relative_to(OUT).as_posix(), compress_type=method)
    print(f'{ZIP.name}: {len(files)} files, {ZIP.stat().st_size / 2**20:.1f} MB')


if __name__ == '__main__':
    main()
