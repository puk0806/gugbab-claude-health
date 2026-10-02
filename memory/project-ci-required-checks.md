---
name: project-ci-required-checks
description: main 필수 검사(ci + visual-regression) 도입 — 선행 조건·순서 함정 (2026-10-01)
metadata:
  type: project
---

2026-10-01, 4개 레포(package·voca·dream·health)를 같은 CI 보호 기준으로 통일하는
작업의 health 몫. 규칙(ruleset) 자체는 package 레포 세션이 API로 적용한다.

**목표 규칙**: main = PR 필수(승인 0) + 필수 검사 `ci`·`visual-regression`(strict)
+ 소유자 우회 없음 + 강제 푸시·삭제 금지.

## ⚠️ 순서 함정 — 먼저 적용하면 모든 PR이 막힌다

`ci.yml`이 **main에 머지된 뒤에** 규칙을 적용해야 한다. 반대로 하면 존재하지 않는
검사를 기다리느라 모든 PR이 영구히 블록된다. health는 ci.yml 머지 후 package
세션에 SendMessage로 알리는 절차가 포함돼 있다.

## ⚠️ 선행 조건 — `biome ci .`가 레포 전체에서 통과해야 한다

`ci` 잡이 `pnpm exec biome ci .`를 돌리는데, 도입 시점 health는 **11 errors**로
실패하는 상태였다(포맷 8·import 정렬 2·미사용 suppression 4·PWA 아이콘 SVG 1).
이대로 필수 검사를 켜면 모든 PR이 막힌다. 반드시 **켜기 전에** 정리할 것.

- `biome check --write .`로 대부분 자동 수정
- `suppressions/unused`: biome.json 테스트 override가 이미 `noExplicitAny`를 꺼서
  `biome-ignore` 주석이 불필요해진 케이스 → 주석 제거
- `public/**`는 린트 제외로 전환 — 정적 자산이고 PWA 아이콘 SVG가
  `noSvgWithoutTitle`에 걸린다(인라인 JSX용 규칙의 오탐)

과거에는 "요청 범위 밖"이라며 포맷 변경을 되돌렸지만, 필수 검사 도입 후에는
레포 전체 biome 청결이 **전제 조건**이 되므로 판단이 뒤집힌다.

## accept-baseline 라벨이 ci를 막는 문제

accept-baseline 커밋은 `GITHUB_TOKEN` 봇 push라 워크플로우를 트리거하지 못한다.
`ci`가 필수가 되면 라벨을 붙여도 PR이 안 풀린다. → visual-regression.yml에
**"Carry ci result to baseline commit"** 단계를 둔다: 변경이 스크린샷뿐이고
직전 커밋 ci가 성공일 때만 그 결과를 새 SHA로 승계(`permissions: checks: read` 필요).
스크린샷 외 변경이 섞이면 승계를 거부한다 — 검사 우회 방지.

관련: [[project-deploy-workflow]] [[project-e2e-testing-notes]]
