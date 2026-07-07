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

관련: [[project-deploy-workflow]] [[env-corp-tls-interception]]
