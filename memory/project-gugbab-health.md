---
name: project-gugbab-health
description: gugbab-health 앱 개요 — 식료품 등록 + 신체 지표 기반 유동적 식단 설계 앱
metadata: 
  node_type: memory
  type: project
  originSessionId: b9edb9ce-c780-4548-aaac-3b9201f65045
---

집에 있는 식료품을 등록하고, 사용자의 성별·몸무게 변화·인바디 변화 등 신체 지표를 입력받아
유동적으로 식단을 자동 설계해주는 앱.

**Why:** 개인화된 건강 식단 관리 목적. 냉장고/식재료 상황에 맞는 현실적인 식단 제안.

**How to apply:** 설계·기획 단계에서 이 두 축(식재료 관리 + 신체 지표 기반 식단 추천)을 항상 중심에 두고 판단한다.

## 확정된 기술스택

- **프레임워크**: Next.js (App Router) + TypeScript
- **PWA**: @serwist/next (dream 앱 동일)
- **UI 패키지**: @gugbab/styled-radix + @gugbab/tokens
- **DB**: IndexedDB 로컬 전용 (idb 또는 Dexie)
- **AI**: OpenAI SDK (API Route로 서버사이드 호출)
- **린트**: Biome (@gugbab/biome-config)
- **테스트**: Playwright 시각 회귀
- **배포**: Vercel

## 확정된 방향

- **플랫폼**: 웹 PWA → Vercel 배포
- **식단 추천 방식**: AI + 규칙 혼합 (대화형 UI)
- **화면 구성**: 식재료 등록 화면 별도 존재
- **중복 방지**: 이전 메뉴와 최대한 안 겹치게 (추후 강제성 로직 추가)
- **목표(지향성)**: 사용자가 복수 선택 가능 (감량/증량/유지/벌크업/건강관리 등)
- **대화형 UI**: 순수 텍스트 채팅 — AI가 질문과 A/B/C 선택지를 메시지로 전송, 사용자는 "A" 또는 자유 텍스트로 응답. 버튼/칩 없음. 지금 Claude와 대화하는 방식과 동일한 UX
- **신체 지표**: 성별·몸무게 변화·인바디 변화 등

진행 방식: 대화 → 설계 → 기술스택 결정 → 기획서 → 구현 계획 순서로 단계적으로 진행 중.
현재 단계: 브레인스토밍 / 명확화 질문 단계 (2026-06-27 시작)
