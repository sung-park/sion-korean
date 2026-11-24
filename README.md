# 시온이의 이음말 탐험

초2 눈높이로 **그리고 · 그런데 · 그래서**를 매일 10분씩 연습하는 웹앱입니다. (설치형 · 오프라인 지원)

- 라이브: https://sung-park.github.io/sion-korean/
- 문제 유형 8가지: 빈칸 채우기 · 이어 말하기 · 어떤 사이? · 문장 줄이기 · 조각 맞추기 · 숨은 이음말 · 틀린 곳 찾기 · 짝 맞추기
- 내용: 생활 문장 62세트(첫 문장 1개 + 이음말별 뒷문장), 이음말 짝 180개 — `js/content.js`
- 줄인 문장(-고 / -는데·-은데·-ㄴ데 / -아서·-어서·-해서)은 `js/grammar.js`가 만들고, `node tools/check.mjs`로 전부 출력해 사람이 검토합니다.
  불규칙 활용(ㅂ·ㄷ·ㅅ·ㅎ·르)은 표에 없으면 오류를 내도록 되어 있어 잘못된 활용이 몰래 들어가지 않습니다.
- 진행 기록: localStorage `sk.v1` (필드는 추가만 하고 이름을 바꾸지 않음 → 예전 기록과 호환)
- 소리: 아빠 목소리(ElevenLabs 복제 음성 '성근2')로 미리 만든 mp3만 사용 (assets/audio/d/, 음량 -16 LUFS로 맞춤)(브라우저 TTS 없음). 아이폰 무음 모드에서도 재생되도록 audioSession=playback + Web Audio 잠금 해제.
  `node tools/dump_lines.mjs > /tmp/lines.json && ELEVENLABS_API_KEY=... python3 tools/gen_audio.py /tmp/lines.json`
- 배포 규칙: 앱 파일을 바꾸면 `sw.js`의 `VERSION`과 `index.html`의 `?v=`를 함께 올립니다.
- 블록 그림은 직접 만든 픽셀 아트(SVG)이며, 상표·외부 게임 에셋을 쓰지 않습니다.
