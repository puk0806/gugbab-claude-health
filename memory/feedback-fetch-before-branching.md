---
name: feedback-fetch-before-branching
description: 작업 브랜치 생성 전 반드시 git fetch로 원격 최신 확인 — 캐시된 origin/main 참조를 믿지 말 것
metadata: 
  node_type: memory
  type: feedback
  originSessionId: df509390-3f27-4b5f-aa8f-52fb19f66c7d
---

작업 브랜치를 만들기 전에 반드시 `git fetch origin`을 먼저 실행하고, 최신 `origin/main` 위에서 분기한다. 로컬에 캐시된 `origin/main` 참조는 마지막 fetch 시점의 스냅샷일 뿐이다.

**Why:** 2026-07-08 식단 칼로리 프롬프트 PR 작업 때 fetch 없이 낡은 origin/main(PR #8 시점)에서 분기 — 실제 원격은 PR #9 머지로 5커밋 앞서 있었고, 사용자가 낡은 베이스를 지적함. 사용자는 "pull 받고 작업했어야지"라며 강하게 질책.

**How to apply:**
- 브랜치 생성 직전: `git fetch origin` → `git checkout -b <branch> origin/main`
- 이미 만든 브랜치가 뒤처졌으면 origin/main을 **머지**로 업데이트 (force push는 훅이 차단하므로 rebase 후 force push 불가 — GitHub "Update branch"와 동일한 머지 방식 사용)
- 관련: [[feedback-commit-push-discipline]], [[project-deploy-workflow]]
