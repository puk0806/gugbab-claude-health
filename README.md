# gugbab-health

식재료 등록 + 신체 지표 기반 AI 개인화 식단 PWA

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.2.6 (App Router, TypeScript strict) |
| PWA | @serwist/next 9.5.11 |
| 로컬 DB | IndexedDB via `idb` 8.0.3 |
| AI | OpenAI SDK 6.x |
| 린트/포맷 | Biome 2.x |
| 단위 테스트 | vitest 3.x + @testing-library/react + happy-dom |
| E2E 테스트 | Playwright (Phase 4 예정) |
| 패키지 매니저 | pnpm 9.x |
| 배포 | Vercel |

---

## 프로젝트 구조

```
app/
├── layout.tsx          # 루트 레이아웃 (PWA 메타, viewport-fit=cover)
├── page.tsx            # AI 채팅 탭 (홈)
├── onboarding/         # 온보딩 (성별·목표 입력)
├── ingredients/        # 식재료 등록 탭
├── body/               # 신체 지표 탭
├── settings/           # 설정 탭
└── sw.ts               # Service Worker (serwist)

components/
└── layout/
    └── BottomNav.tsx   # 하단 탭 네비게이션

lib/
└── db/
    ├── index.ts        # IndexedDB 초기화 (getDB, getLocalDateString)
    ├── types.ts        # DB 타입 정의
    ├── userProfile.ts  # 사용자 프로필 CRUD
    ├── ingredients.ts  # 식재료 CRUD
    ├── bodyMetrics.ts  # 신체 지표 CRUD
    └── mealHistory.ts  # 식사 기록 CRUD
```

---

## 개발 명령어

```bash
pnpm dev              # 개발 서버 (Turbopack)
pnpm build            # 프로덕션 빌드 (webpack)
pnpm typecheck        # TypeScript 타입 검사
pnpm check            # Biome lint + format 검사
pnpm check:fix        # Biome 자동 수정
pnpm test:unit        # vitest 단위 테스트
pnpm test:unit:watch  # vitest watch 모드
pnpm test:visual      # Playwright E2E (Phase 4)
```

---

## 구현 현황

### Phase 1 — 기반 세팅 ✅ 완료

- [x] Next.js App Router + TypeScript strict 초기 세팅
- [x] PWA 설정 (`@serwist/next`, `viewport-fit=cover`, iOS safe-area)
- [x] IndexedDB 스키마 설계 (`userProfile`, `ingredients`, `bodyMetrics`, `mealHistory`)
- [x] 4개 탭 라우팅 + BottomNav 레이아웃
- [x] vitest + @testing-library 단위 테스트 환경 구성
- [x] 단위 테스트 23개 (7개 파일) 전부 PASS
- [x] tdd-guard 훅 (최소 예외: `app/sw.ts`, `lib/db`, `lib/ai`, `e2e`)
- [x] Codex 3라운드 적대적 리뷰 완료 — 버그 5건 수정

  | 수정 항목 | 내용 |
  |-----------|------|
  | iOS safe-area | `env(safe-area-inset-bottom)` 적용 (BottomNav + page) |
  | `getRecentMealHistory` 오프바이원 | `days` → `days - 1` 커트오프 수정 |
  | `userProfile` 경쟁 조건 | 고정 키 `"user-profile"` + `db.get()` 직접 조회 |
  | `viewport-fit=cover` 누락 | Next.js Viewport 메타에 `viewportFit: "cover"` 추가 |
  | IndexedDB 프로미스 캐시 오염 | 실패 시 `dbPromise = null` 리셋 추가 |

### Phase 2 — 핵심 기능 구현 ✅ 완료

- [x] 온보딩 (성별·목표 선택 → IndexedDB 저장 → 홈 리다이렉트)
- [x] 식재료 탭 (이름·카테고리 추가, 목록, 삭제)
- [x] 신체 지표 탭 (체중·체지방률·골격근량 입력, 최근 7일 목록)
- [x] 설정 탭 (프로필 조회·성별·목표 수정)
- [x] 홈 화면 — 프로필 없으면 온보딩 자동 리다이렉트
- [x] 단위 테스트 31개 (7개 파일) PASS

### Phase 3 — AI 채팅 (예정)

- [ ] OpenAI 기반 식단 자동 설계
- [ ] 식재료·신체 지표 컨텍스트 주입

### Phase 4 — E2E 테스트 (예정)

- [ ] Playwright 시각 회귀 테스트
- [ ] IndexedDB 통합 테스트 (`fake-indexeddb` 또는 Playwright)

---

## 업데이트 로그

| 날짜 | 내용 |
|------|------|
| 2026-06-27 | Phase 1 완료: 기반 세팅, DB 스키마, 라우팅, 단위 테스트 23개, Codex 리뷰 5건 수정 / Phase 2 완료: 온보딩·식재료·신체지표·설정 실 기능, 단위 테스트 31개 |
