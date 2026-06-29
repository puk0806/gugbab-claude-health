---
name: feedback-e2e-verification-before-report
description: 완료 = 동작 확인. 테스트 없이 완료 보고 절대 금지
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b9edb9ce-c780-4548-aaac-3b9201f65045
---

코드를 작성하거나 설정을 변경하면 반드시 실행해서 동작을 확인한 후 완료 보고한다. 테스트하지 않은 것은 완료가 아니다.

**Why:** branch protection + visual regression 워크플로우 작성 후 실행 없이 "완료" 보고. 사용자가 accept-baseline 라벨을 붙였더니 CI가 실패했고, `.gitignore` 충돌로 `git add`가 막히는 기초적인 버그가 있었음. 사용자 입장에서는 "동작하지 않는 쓰레기 코드를 완료라고 넘기는" 상황.

**How to apply:**
- 로컬에서 실행 가능한 코드: 실행하고 결과 확인 후 보고.
- CI/CD 워크플로우: compare 모드 + accept 모드 두 경로 모두 실제 실행으로 확인 후 보고. 직접 트리거하기 어려우면 테스트 커밋 push해서 CI 결과 확인.
- 직접 검증이 불가능한 경우에만: "설정 완료 — 실제 실행으로 검증이 필요합니다"라고 명시하고 이유를 밝힘.
- "코드를 썼다" ≠ "완료". "실행해서 동작한다" = 완료.
