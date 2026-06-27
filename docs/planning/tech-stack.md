# 기술 스택

> 최종 업데이트: 2026-06-27  
> 레퍼런스: `03_gugbab-claude-dream` (Next.js PWA 패턴 기준)

---

## 핵심 스택

| 레이어 | 기술 | 버전 | 비고 |
|--------|------|------|------|
| 프레임워크 | Next.js | 16.x | App Router |
| 언어 | TypeScript | 5.x | strict 모드 |
| 런타임 | Node.js | ≥22.13 | |
| 패키지 매니저 | pnpm | 9.15.x | |

---

## UI

| 항목 | 기술 | 비고 |
|------|------|------|
| UI 컴포넌트 | `@gugbab/styled-radix` | Radix 기반 디자인 시스템 |
| 디자인 토큰 | `@gugbab/tokens` | 색상·타이포·간격 |
| 공통 훅 | `@gugbab/hooks` | |
| 공통 유틸 | `@gugbab/utils` | |
| 스타일링 | CSS Modules (또는 styled-radix 내장) | 인라인 스타일 금지 |

---

## PWA

| 항목 | 기술 | 비고 |
|------|------|------|
| PWA | `@serwist/next` | dream 앱 동일 패턴 |
| Service Worker | Serwist | 오프라인 캐시 전략 |
| PWA Assets | `@vite-pwa/assets-generator` 또는 수동 | 아이콘 생성 |

---

## 데이터

| 항목 | 기술 | 비고 |
|------|------|------|
| 로컬 DB | `idb` (IndexedDB wrapper) | dream 앱 동일 |
| 스토어 설계 | 커스텀 repository 패턴 | |

### IndexedDB 스토어 구조 (초안)

```
DB: gugbab-health

stores:
  ingredients     — { id, name, category, addedAt }
  bodyMetrics     — { id, date, weight, bodyFatPct, skeletalMuscleMass }
  mealHistory     — { id, date, messages: ChatMessage[], summary }
  userProfile     — { id, gender, goals: string[], createdAt }
```

---

## AI 연동

| 항목 | 기술 | 비고 |
|------|------|------|
| AI 제공자 | OpenAI | 추후 Claude 전환 가능 |
| SDK | `openai` npm 패키지 | |
| 호출 위치 | Next.js API Route (`/api/chat`) | 클라이언트에 API 키 노출 금지 |
| 스트리밍 | OpenAI Streaming | 타이핑 효과 |
| 스킬·에이전트 연동 | **A 또는 B 중 구현 시 결정** | |

### AI context 구성 (매 요청 시 포함)

```
system prompt:
  - 사용자 프로필 (성별, 목표)
  - 최근 신체 지표 3개 + 변화율
  - 현재 식재료 목록 전체
  - 최근 N일 식단 이력 (중복 방지)
  - [스킬 내용 또는 function definitions]

user messages:
  - 현재 대화 히스토리
```

---

## 품질 도구

| 항목 | 기술 | 비고 |
|------|------|------|
| 린트·포맷 | Biome | `@gugbab/biome-config` |
| 타입 체크 | tsc --noEmit | CI에서 검증 |
| 시각 회귀 | Playwright | UI 변경 시 스냅샷 비교 후 머지 |
| 유닛 테스트 | Vitest (선택) | 순수 로직 함수 대상 |

---

## 배포

| 항목 | 기술 | 비고 |
|------|------|------|
| 호스팅 | Vercel | |
| 환경변수 | Vercel 대시보드 | `OPENAI_API_KEY` 등 |
| 브랜치 전략 | main → Vercel 자동 배포 | PR은 Preview 배포 |

---

## 개발 환경 스크립트 (예정)

```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit",
  "lint": "biome lint .",
  "lint:fix": "biome lint --write .",
  "format": "biome format --write .",
  "check": "biome check .",
  "check:fix": "biome check --write .",
  "test:visual": "playwright test",
  "test:visual:update": "playwright test --update-snapshots",
  "test:visual:report": "playwright show-report"
}
```

---

## 레퍼런스 프로젝트

| 프로젝트 | 참고 포인트 |
|---------|------------|
| `03_gugbab-claude-dream` | Next.js + Serwist PWA + idb + OpenAI 패턴 전체 |
| `02_gugbab-claude-voca` | Playwright 시각 회귀 테스트 설정 |
| `01_gugbab-claude-package` | UI 패키지 사용 방법 |
