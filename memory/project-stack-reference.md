---
name: project-stack-reference
description: gugbab 앱들의 공통 기술스택 패턴 — 새 앱 설계 시 참고
metadata: 
  node_type: memory
  type: reference
  originSessionId: b9edb9ce-c780-4548-aaac-3b9201f65045
---

## 공통 패턴 (02_voca, 03_dream 기준)

| 항목 | voca (Vite) | dream (Next.js) |
|------|-------------|-----------------|
| 프레임워크 | Vite + React 19 | Next.js 16 + React 19 |
| PWA | vite-plugin-pwa | @serwist/next |
| DB (로컬) | Dexie (IndexedDB) | idb (IndexedDB) |
| 상태관리 | Zustand | - |
| 라우팅 | react-router-dom v7 | Next.js App Router |
| 린트/포맷 | Biome (@gugbab/biome-config) | Biome (@gugbab/biome-config) |
| 시각 회귀 | Playwright | Playwright |
| 단위 테스트 | Vitest | - |
| 패키지 매니저 | pnpm | pnpm |
| 배포 | Vercel | Vercel |
| AI | - | OpenAI SDK |
| 검증 | - | Zod |

## gugbab npm 패키지

- `@gugbab/styled-radix` — Radix 스타일 UI 컴포넌트 (dream에서 사용)
- `@gugbab/styled-mui` — MUI 스타일 UI 컴포넌트 (voca에서 사용)
- `@gugbab/tokens` — 디자인 토큰
- `@gugbab/hooks` — 공통 React 훅
- `@gugbab/utils` — 공통 유틸리티
- `@gugbab/biome-config` — Biome 공통 설정

## 참고 경로

- UI 패키지: `/Users/lf/Desktop/gugbab-workspace/01_gugbab-claude-package`
- Vite PWA 레퍼런스: `/Users/lf/Desktop/gugbab-workspace/02_gugbab-claude-voca`
- Next.js PWA 레퍼런스: `/Users/lf/Desktop/gugbab-workspace/03_gugbab-claude-dream`
