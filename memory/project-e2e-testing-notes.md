---
name: project-e2e-testing-notes
description: "health 앱 브라우저 E2E 검증 노하우 — Playwright 프로덕션 검증 패턴, dev 모드 함정, 포트 주의"
metadata: 
  node_type: memory
  type: project
  originSessionId: 129f65e5-2b78-4b68-a65e-571f8f9d9d0e
---

검증된 패턴 (2026-07-07~08):

- **Playwright는 `@playwright/test`로 설치돼 있음** (VRT용). 일회성 스크립트는 scratchpad에 .mjs로 쓰고 `createRequire("<repo>/package.json")`로 로드 — scratchpad에서 직접 import하면 모듈 해석 실패.
- **브라우저 전용 API는 가짜 주입으로 E2E 가능**: `page.addInitScript`로 `window.SpeechRecognition`(마이크)·`beforeinstallprompt` 디스패치(PWA 설치)를 재현해 프로덕션 배포본까지 검증 가능. 마이크 실제 음성→구글 STT 구간만 자동화 불가.
- **⚠️ Next dev 모드에서 headless 상호작용이 죽는 현상** — 클릭해도 React 상태 불변(hydration 문제, 재시작해도 동일). **`pnpm build` + `PORT=xxxx pnpm start`(프로덕션 빌드)로 테스트하면 정상**. E2E 판정은 반드시 프로덕션 빌드 기준으로.
- **⚠️ localhost:3001은 다른 프로젝트(CRA)가 `[::1]`에 상주** — `localhost`로 접속하면 IPv6 우선이라 엉뚱한 앱에 붙는다. 로컬 테스트는 **`127.0.0.1` + 3002 이상 포트** 사용. 페이지 `<title>`이 `gugbab-health`인지 먼저 확인.
- React 상태 반영은 비동기 — evaluate로 이벤트 발화 직후 값을 읽으면 레이스로 헛 실패. 폴링/waitFor로 읽을 것.
- 온보딩이 프로필을 요구하므로 E2E는 새 컨텍스트에서 온보딩(성별·목표·키·몸무게)부터 완주하는 헬퍼로 시작.

## ⚠️ 시각 회귀(VR) 베이스라인이 상시 stale — 내 탓인지 먼저 가릴 것 (2026-09-04 확인)

로컬 `e2e/visual/__screenshots__/`의 PNG는 **2026-08-10자**로, 이후 PR #16~#18의
UI 변경을 반영하지 못한다. `pnpm test:visual`을 돌리면 **8개 중 7개가 실패**하는데
이는 기존 상태이지 새 작업의 회귀가 아니다. 게다가 로컬은 macOS 렌더라 CI(Ubuntu)
기준과도 다르다(베이스라인은 .gitignore, CI만 `git add -f`로 커밋).

**내 변경 탓인지 가리는 법** — 실패 목록에 안 건드린 화면이 섞여 있으면 의심하고:
1. `main`에서 `pnpm test:visual` 실행 → 같은 목록이 실패하는지 확인
2. 확실히 하려면 양쪽 `test-results/**/*-actual.png`를 `cmp`로 픽셀 비교.
   전부 동일하면 내 변경은 시각적 영향 0이다 (PR #19에서 이 방법으로 무관함 입증)

베이스라인 갱신이 필요하면 `accept-baseline` 라벨로 CI에서 Ubuntu 기준 재생성.
로컬 macOS PNG를 커밋하지 말 것.

관련: [[project-deploy-workflow]] [[env-corp-tls-interception]] [[project-speech-package-migration]]
