---
name: feedback-git-workflow
description: "gugbab-health 프로젝트 Git 워크플로우 — 피처 브랜치 필수, main 직접 push 금지"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b9edb9ce-c780-4548-aaac-3b9201f65045
---

작업 시 항상 피처 브랜치를 생성해서 작업하고, PR로 머지한다.

**Why:** 초기 origin/main 없는 상태에서 첫 push는 사용자가 직접 처리. 이후부터는 branch-protection 훅 정책 준수.

**How to apply:**
- 구현 작업 시작 전 `git checkout -b feature/{작업명}` 으로 브랜치 생성
- push는 `git push origin feature/{작업명}`
- PR 생성 후 main 머지는 사용자가 직접 처리
- main 직접 push는 절대 하지 않는다 (훅이 차단하므로 --no-verify도 사용 금지)
