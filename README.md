# thefollower

THE FOLLOWER — 심령 라이브 방송 콘셉트의 크래시 게임 POC (모바일 웹, 1080×1920).

## 실행

오디오를 fetch로 디코딩하므로 `file://`이 아닌 http로 열어야 합니다.

```bash
python -m http.server 8771
```

브라우저에서 `http://localhost:8771/poc/index.html`을 엽니다. `?dev`를 붙이면 다음 크래시 배수를 지정하는 개발용 패널이 열립니다.

## 구성

- `poc/` — 게임 (`index.html`, `style.css`, `content.js`, `game.js`)
- `assets/` — 런타임 에셋과 원본 (`src/` 생성 이미지, `kling/` 괴물 원본 영상, `fonts/src/` 원본 폰트)
- `tools/` — 에셋 파이프라인과 검증 스크립트
- `시안/` — 콘셉트 시안 이미지

## 배포용 zip

```bash
python tools/build_release.py
```

`release/TheFollower_POC.zip`이 만들어지며, zip 루트에 `index.html`이 있어 정적 호스팅에 그대로 올릴 수 있습니다.
