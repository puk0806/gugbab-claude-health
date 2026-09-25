---
name: project-speech-package-migration
description: 마이크(STT)를 자체 구현에서 @gugbab/hooks·utils 공통 훅으로 이관 (2026-09-04 PR #19)
metadata:
  type: project
---

2026-09-04 PR #19로 health 앱의 마이크 기능을 공통 패키지로 이관했다.
dream 앱도 같은 패키지로 이전 완료(그쪽 PR #16) — 3앱 공통 기반이다.

## 무엇이 어디로 갔나

| 삭제된 것 | 대체 |
|---|---|
| `lib/speech.ts` (Web Speech API 래퍼 95줄) | `@gugbab/hooks`의 `createRecognizer`·`isSpeechRecognitionSupported`·`MicError` |
| `ChatInputBar`의 인라인 상태 관리 (listening/interim/error, 세션 교체 가드, 언마운트 abort) | `useSpeechRecognition` 훅 |
| `ChatInputBar`의 자체 `appendTranscript` | `@gugbab/utils`의 `appendTranscript` |

`lib/speech.ts`·`lib/speech.test.ts`는 삭제됐다. 순 -282줄.
버전: `@gugbab/hooks` 1.3.0, `@gugbab/utils` 1.4.0 이상 필요.

**앱에 남긴 것**: 에러 문구 매핑(`MIC_ERROR_MESSAGES`). 훅은 `MicError` 분류만
반환하고 사용자 문구는 앱 정책이라는 설계다. `disabled`(스트리밍 중) 시
진행 중 인식 파기는 훅의 `abort()`를 쓴다.

## 함정 — 패키지 모킹

`app/page.test.tsx`가 `@gugbab/hooks`를 **통째로 모킹**한다. 패키지에 export가
늘어나면 이 모킹에도 추가해야 한다. 안 하면
`No "X" export is defined on the "@gugbab/hooks" mock`으로 **35개가 한꺼번에 실패**한다.

## 테스트 방식 — 모듈 모킹 대신 가짜 전역

훅은 번들된 한 파일 안에서 `createRecognizer`를 내부 호출하므로, 모듈 export를
모킹해도 **가로채지지 않는다**. 그래서 `ChatInputBar.test.tsx`를
가짜 `window.SpeechRecognition` 주입 방식으로 바꿨다 (통합 테스트가 원래
쓰던 방식과 동일). 훅 내부 동작은 패키지가 검증하므로 앱은 배선만 본다.

이관이 안전했다는 근거: 기존 통합 테스트가 **수정 없이 그대로 통과**했다.

## 검증 한계

실제 음성 입력은 브라우저 자동화로 오디오를 만들 수 없어 검증 불가.
UI 토글·supported 판정·콘솔 에러까지는 프로덕션에서 확인했고, 실 STT 구간만
사람이 직접 확인해야 한다.

관련: [[project-e2e-testing-notes]] [[project-gugbab-health]]
