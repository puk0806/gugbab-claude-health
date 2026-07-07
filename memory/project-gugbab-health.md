---
name: project-gugbab-health
description: gugbab-health 앱 개요 — 식료품 등록 + 신체 지표 기반 식단 설계 PWA (relay 연동·대화방까지 프로덕션 운영 중)
metadata: 
  node_type: memory
  type: project
  originSessionId: 129f65e5-2b78-4b68-a65e-571f8f9d9d0e
---

집에 있는 식료품을 등록하고, 성별·몸무게·인바디 변화 등 신체 지표를 입력받아
유동적으로 식단을 자동 설계해주는 대화형 PWA.

**Why:** 개인화된 건강 식단 관리. 냉장고/식재료 상황에 맞는 현실적인 식단 제안.
**How to apply:** 설계 판단의 중심축은 항상 (식재료 관리 + 신체 지표 기반 추천) 두 가지.

## 기술스택 (확정·운영 중)

- Next.js App Router + TypeScript, PWA(@serwist/next), @gugbab/styled-radix + tokens
- IndexedDB(idb) 로컬 전용 — **DB v2**: conversations(대화방)·userProfile·ingredients·bodyMetrics
- AI: [[architecture-ai-integration]] 참조 (gugbab-claude-relay 경유 Claude)
- Biome / vitest(happy-dom·testing-library) / Playwright VRT / pnpm / Vercel

## 완료된 주요 기능 (2026-07-07 기준, 프로덕션 배포됨)

- 채팅: relay SSE 스트리밍, **대화방 시스템**(목록·전환·삭제, 새 대화=새 방, 활성 방 localStorage 영속화)
- **모델 선택**: 헤더 칩 → 바텀시트, `/api/models` 동적 로딩, fable 포함 4종
- **식재료 부족(3개 미만) 시 추천 방식 강제 선택**(보유 재료로만/자유) — 대화방당 1회, 방에 저장
- **마이크 음성 입력**(Web Speech, dream 포팅) — interim 힌트 → final 입력
- 온보딩: 성별·목표 + **키·몸무게(필수)·체지방·골격근(선택)** → 프로필+첫 지표 기록. 앱 설치 안내(InstallSection)
- 입력 검증: `lib/ai/limits.ts` **BODY_LIMITS가 UI·API 공유 단일 소스** (범위 밖 → 필드별 빨간 에러+저장 차단)
- 모바일: safe-area 헤더 패딩, 핀치/더블탭 줌 차단, 입력 16px(iOS 자동확대 방지)

## 대화 UX 원칙 (초기 확정, 유지 중)

- 순수 텍스트 채팅(버튼/칩 없는 대화) 기조 — 단, 시스템 차원 선택(모델·추천 방식)은 UI 칩 허용됨
- 신체 지표는 몸무게·체지방률·골격근량 시계열, 식재료는 이름만(그람수 없음)
- 이전 식단과 중복 최소화, 목표는 복수 선택
