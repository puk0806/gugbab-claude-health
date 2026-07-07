---
name: project-deploy-workflow
description: "gugbab-health 배포 워크플로우 — main 직접 푸시 차단(PR 필수), Vercel 실서비스 프로젝트 식별, env 주입 규칙"
metadata: 
  node_type: memory
  type: project
  originSessionId: 129f65e5-2b78-4b68-a65e-571f8f9d9d0e
---

- **main 직접 푸시 불가** — `branch-protection` 훅(2026-07-07 도입)이 차단. 절차: 피처 브랜치 → `git push origin <branch>` → `gh pr create` → 사용자가 머지(요청 시 대행 가능). 커밋 직후 `.git/index.lock` 레이스가 잦으니(IDE git 연동 추정) add/commit에 재시도 루프 필요.
- **Vercel 실서비스 프로젝트 = `gugbab-claude-health`** (팀 `puk0806s-projects`, 프로덕션 https://gugbab-claude-health.vercel.app). ⚠️ 비슷한 이름의 **구 중복 프로젝트가 존재** — "마지막 배포 12일 전"으로 보이면 잘못된 프로젝트를 보고 있는 것. 환경변수도 반드시 실서비스 쪽에.
- **환경변수는 배포 시점에 주입** — 변수 추가/변경 후 반드시 Redeploy(또는 Create Deployment → main). 머지로 트리거되는 배포도 동일 효과.
- **배포 확인 방법**: GitHub 커밋 status에 Vercel state(`gh api repos/puk0806/gugbab-health/commits/<sha>/status`) + 프로덕션 HTML의 `page-*.js` 청크 해시 변화 + 청크 내 신규 문자열 grep. GitHub 저장소는 `puk0806/gugbab-health`(gh는 구명 gugbab-claude-health로 리다이렉트 표시).
- **PWA 캐시**: 배포 후 사용자 기기는 서비스워커 갱신 필요 — 새로고침 2번 또는 앱 완전 종료 후 재실행. "Clear site data"는 IndexedDB(사용자 데이터)까지 지우니 안내 금지.

관련: [[env-corp-tls-interception]] [[project-e2e-testing-notes]]
