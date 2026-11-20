# gugbab-health

식재료 등록 + 신체 지표 + 운동 기록 기반 AI 개인화 식단·운동 PWA

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.2.6 (App Router, TypeScript strict) |
| PWA | @serwist/next 9.5.11 |
| 로컬 DB | IndexedDB via `idb` 8.0.3 |
| AI | Claude — gugbab-claude-relay 경유 SSE 프록시 (`@gugbab/relay-types` 계약) |
| 린트/포맷 | Biome 2.x |
| 단위 테스트 | vitest 3.x + @testing-library/react + happy-dom |
| E2E 테스트 | Playwright 1.60.0 (시각 회귀) |
| 패키지 매니저 | pnpm 9.x |
| 배포 | Vercel |

---

## 프로젝트 구조

```
app/
├── layout.tsx          # 루트 레이아웃 (PWA 메타, viewport-fit=cover)
├── page.tsx            # AI 채팅 탭 (홈)
├── api/chat/           # relay SSE 프록시 API Route (컨텍스트 검증·시스템 프롬프트 생성)
├── api/models/         # 사용 가능한 모델 목록
├── onboarding/         # 온보딩 (성별·목표 입력)
├── ingredients/        # 식재료 등록 탭
├── body/               # 신체 지표 탭
├── workout/            # 운동 탭 (루틴 목록·다음 권장 무게·최근 기록)
│   ├── routine/        # 루틴 만들기·편집
│   └── session/        # 세트 기록 (권장 무게 미리 채움, 입력 임시 저장)
├── settings/           # 설정 탭
└── sw.ts               # Service Worker (serwist)

components/
└── layout/
    └── BottomNav.tsx   # 하단 탭 네비게이션

lib/
├── ai/
│   ├── types.ts        # AI 타입 (UserContext, ChatSseEvent)
│   └── context.ts      # 동적 시스템 프롬프트 생성
├── training/
│   ├── catalog.ts      # 기본 운동 16종·증량 단위
│   ├── limits.ts       # 운동 입력 허용 범위 (UI·API 공유)
│   ├── progression.ts  # 다음 무게 (더블 프로그레션)·추정 1RM (Epley)
│   ├── trends.ts       # 부위별 주간 세트·종목 추세(상승·유지·정체·하락)
│   ├── routineBlock.ts # 답변 속 ```routine 블록 파싱·종목 연결
│   └── context.ts      # 대화용 운동 컨텍스트
└── db/
    ├── index.ts        # IndexedDB 초기화 (getDB, getLocalDateString)
    ├── types.ts        # DB 타입 정의
    ├── userProfile.ts  # 사용자 프로필 CRUD
    ├── ingredients.ts  # 식재료 CRUD
    ├── bodyMetrics.ts  # 신체 지표 CRUD
    ├── exercises.ts    # 운동 종목 (기본 + 사용자 추가)
    ├── routines.ts     # 루틴 CRUD
    ├── routineDraft.ts # 대화에서 제안된 루틴 저장 (없는 종목 생성)
    ├── workouts.ts     # 운동 세션 기록
    └── conversations.ts # 대화방 CRUD (v2에서 mealHistory 이관)
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
pnpm test:visual      # Playwright 시각 회귀 테스트
```

---

## 구현 현황

### Phase 1 — 기반 세팅 ✅ 완료

- ✅ Next.js App Router + TypeScript strict 초기 세팅
- ✅ PWA 설정 (`@serwist/next`, `viewport-fit=cover`, iOS safe-area)
- ✅ IndexedDB 스키마 설계 (`userProfile`, `ingredients`, `bodyMetrics`, `mealHistory`)
- ✅ 4개 탭 라우팅 + BottomNav 레이아웃
- ✅ vitest + @testing-library 단위 테스트 환경 구성
- ✅ 단위 테스트 23개 (7개 파일) 전부 PASS
- ✅ tdd-guard 훅 (최소 예외: `app/sw.ts`, `lib/db`, `lib/ai`, `e2e`)
- ✅ Codex 3라운드 적대적 리뷰 완료 — 버그 5건 수정

  | 수정 항목 | 내용 |
  |-----------|------|
  | iOS safe-area | `env(safe-area-inset-bottom)` 적용 (BottomNav + page) |
  | `getRecentMealHistory` 오프바이원 | `days` → `days - 1` 커트오프 수정 |
  | `userProfile` 경쟁 조건 | 고정 키 `"user-profile"` + `db.get()` 직접 조회 |
  | `viewport-fit=cover` 누락 | Next.js Viewport 메타에 `viewportFit: "cover"` 추가 |
  | IndexedDB 프로미스 캐시 오염 | 실패 시 `dbPromise = null` 리셋 추가 |

### Phase 2 — 핵심 기능 구현 ✅ 완료

- ✅ 온보딩 (성별·목표 선택 → IndexedDB 저장 → 홈 리다이렉트)
- ✅ 식재료 탭 (이름·카테고리 추가, 목록, 삭제)
- ✅ 신체 지표 탭 (체중·체지방률·골격근량 입력, 최근 7일 목록)
- ✅ 설정 탭 (프로필 조회·성별·목표 수정)
- ✅ 홈 화면 — 프로필 없으면 온보딩 자동 리다이렉트
- ✅ 단위 테스트 31개 (7개 파일) PASS
- ✅ Playwright 시각 회귀 테스트 + GitHub Actions VRT 워크플로우
- ✅ main 브랜치 보호 (visual-regression required status check)

### Phase 3 — AI 채팅 ✅ 완료

- ✅ Gemini 스트리밍 API Route (`/api/chat`, SSE)
- ✅ 동적 context 주입 — 성별·목표·식재료·신체 지표를 시스템 프롬프트에 반영
- ✅ 채팅 UI (메시지 버블, 스트리밍 타이핑 인디케이터, "새 대화" 버튼)
- ✅ 오늘 대화 IndexedDB 저장 및 앱 재진입 시 복원
- ✅ 에러 분류 (429/RESOURCE_EXHAUSTED, 401/403, SAFETY, 503)
- ✅ AbortController 연동 — 새 대화 시 진행 중인 스트림 취소
- ✅ Codex 3라운드 적대적 리뷰 완료 — 버그 3건 수정

  | 수정 항목 | 내용 |
  |-----------|------|
  | DB 에러 시 온보딩 강제 이동 | 프로필 에러만 리다이렉트, 나머지는 빈 값 처리 |
  | streaming 상태 경쟁 조건 | `abortRef` 비교 가드로 이전 요청이 새 요청 상태 덮어쓰기 방지 |
  | UTF-8 flush 누락 | `done` 시 `decoder.decode()` 호출로 잔여 바이트 처리 |

### Phase 4 — E2E 테스트 ✅ 완료

- ✅ Playwright 시각 회귀 8개 스냅샷 (onboarding, ingredients×2, body×2, settings, chat-empty, chat-with-messages)
- ✅ IndexedDB 시드 헬퍼 (`mealHistory` 지원 추가)

### Phase 5 — 운동 기록 ✅ 2단계 완료

- ✅ 하단 탭 5개: 대화 · 운동 · 식재료 · 지표 · 설정
- ✅ 루틴 만들기 (기본 종목 16종 + 직접 추가, 목적별 반복 범위 프리셋)
- ✅ 세트 기록: 권장 무게 미리 채움, 완료 체크, 새로고침해도 입력 유지
- ✅ 다음 무게 규칙: 목표 세트 모두 상한 달성 → 증량(바벨 상체 2.5kg·하체 5kg·덤벨 1~2kg), 하한 2회 연속 미달 → 약 10% 디로드, 그 외 유지
- ✅ 대화에 최근 운동 기록·다음 권장 무게 주입 (루틴 설계 지침 포함)
- ✅ 기록 기반 루틴 조정용 요약 주입: 부위별 주간 완료 세트(최근 4주), 종목별 추세(회차별 최고 세트·상승/유지/정체/하락), 현재 루틴 구성
- ✅ 대화에서 제안한 루틴을 바로 저장: 답변의 ```routine 블록 → "루틴으로 저장" 카드. 같은 이름이면 업데이트/새로 저장 선택, 앱에 없는 종목은 부위·기구가 있으면 새로 만들고 없으면 제외
- [ ] 기록 추이 그래프

### Phase 6 — 고도화 (예정)

- [ ] 이전 식단 이력 context 주입 (대화 종료 시 summary 생성 → 다음 대화에 포함)
- [ ] 이전 메뉴 중복 방지 로직
- [ ] 식재료 유통기한 추적
- [ ] 주간 식단 플래닝 뷰
- [ ] 칼로리 자동 계산 및 시각화

---

## 환경변수

```bash
# .env.local (gitignore됨 — commit 금지, 형식은 .env.example 참고)
RELAY_URL=https://your-relay-domain.vercel.app   # gugbab-claude-relay 배포 URL
RELAY_SECRET=...                                  # relay 공유 시크릿 — 서버 전용
```

---

## 업데이트 로그

| 날짜 | 내용 |
|------|------|
| 2026-11-20 | 운동 기능 2단계: 대화에 부위별 주간 세트·종목 추세·루틴 구성 요약 주입, 대화 속 루틴 저장 카드. 프롬프트 길이 확보를 위해 식재료명 상한 50→30자 |
| 2026-11-20 | 운동 기능 1단계: 루틴·세트 기록·다음 권장 무게·대화 연동, DB v4(exercises·routines·workoutSessions). 레포 로컬 하네스(.claude/·docs/agents·skills·hooks·memory/·exports/) 제거 — 하네스는 gugbab-claude 래퍼로 일원화 |
| 2026-06-30 | Phase 3 완료: Gemini AI 채팅, SSE 스트리밍, context 주입, Codex 리뷰 3건 수정 / Phase 4 완료: VRT 8개 스냅샷 (채팅 화면 포함) |
| 2026-06-27 | Phase 1 완료: 기반 세팅, DB 스키마, 라우팅, 단위 테스트 23개, Codex 리뷰 5건 수정 / Phase 2 완료: 온보딩·식재료·신체지표·설정 실 기능, 단위 테스트 31개 |
