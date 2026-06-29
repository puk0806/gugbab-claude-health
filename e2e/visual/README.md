# Visual Regression Tests

Playwright 기반 시각 회귀 테스트. Phase 2 핵심 라우트(onboarding / ingredients / body / settings / chat)의 스크린샷 baseline을 관리한다.

## 실행

```bash
# baseline과 비교 (CI 기본 모드)
pnpm test:visual

# baseline 새로 생성/갱신
pnpm test:visual:update

# HTML 리포트 열기
pnpm test:visual:report
```

## PR 워크플로우

1. PR 열기 → GitHub Actions `visual-regression` 자동 실행
2. 시각 차이 있으면 PR 코멘트에 `expected / actual / diff` 인라인 표시
3. 의도된 변경이면 PR에 `accept-baseline` 라벨 부여 → baseline 자동 갱신 + PR 브랜치 commit
4. CI 재실행 통과 → 머지 가능

## 파일 구조

```
e2e/visual/
├── _fixtures/
│   └── init-script.ts   # IndexedDB 초기화 + 시드 헬퍼
├── __screenshots__/      # baseline PNG (git 추적)
├── __diff_archive__/     # PR 머지 시 diff PNG 영구 보관
├── routes.spec.ts        # 라우트별 시각 회귀 테스트
└── README.md
```

## Fixture 패턴

```ts
// 빈 DB (onboarding 테스트용)
await page.addInitScript(FIXTURE_SCRIPT);

// 데이터 시드 (나머지 페이지)
await page.addInitScript(makeSeedScript({ userProfile: SEED_PROFILE, ingredients: SEED_INGREDIENTS }));
```
