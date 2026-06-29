---
name: feedback-e2e-verification-before-report
description: 완료 = 동작 확인. 테스트 없이 완료 보고 절대 금지
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b9edb9ce-c780-4548-aaac-3b9201f65045
---

새 기능·워크플로우 설정 완료를 보고하기 전, 크리티컬 패스(핵심 동작 경로)를 직접 검증해야 한다.

**Why:** branch protection + visual regression 워크플로우 설정 후 "완료" 보고를 했으나, accept-baseline 플로우를 직접 테스트하지 않아 `.gitignore` 충돌(`git add` 실패)을 발견하지 못했다. 결과적으로 사용자가 라벨을 붙였는데 머지가 안 되는 상황이 발생해 추가 디버깅 비용 발생.

**How to apply:**
- CI/CD 워크플로우 설정 후: 테스트 PR 또는 dry-run으로 핵심 경로 검증 후 보고.
- GitHub Actions 워크플로우 accept/compare 모드처럼 분기가 있는 경우, **두 경로 모두** 검증 확인 후 완료 보고.
- 검증 없이 보고 시: "설정 완료 — 단, 실제 CI 실행으로 검증이 필요합니다"라고 명시.
