# gugbab-health 설계 스펙

> 작성일: 2026-06-27  
> 상태: 사용자 리뷰 대기 중

---

## 1. 요구사항 (Requirements)

### 핵심 목표
집에 있는 식재료와 신체 지표를 기반으로 AI가 개인화된 식단을 대화 형태로 추천해주는 1인용 PWA.

### 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| F1 | 식재료 종류(이름)를 등록·삭제·조회할 수 있다 | 필수 |
| F2 | 신체 지표(몸무게·체지방률·골격근량)를 주기적으로 기록할 수 있다 | 필수 |
| F3 | 신체 지표 변화 추이를 그래프로 확인할 수 있다 | 필수 |
| F4 | 성별과 식단 목표를 복수 선택할 수 있다 | 필수 |
| F5 | AI와 텍스트 채팅으로 오늘 식단을 결정할 수 있다 | 필수 |
| F6 | AI는 A/B/C 선택지를 제시하고 자유 텍스트 입력도 이해한다 | 필수 |
| F7 | AI는 식재료·신체지표·목표·이전 이력을 context로 받아 추천한다 | 필수 |
| F8 | AI는 적정 섭취량, 요리 방법, 영양 포인트까지 함께 안내한다 | 필수 |
| F9 | 이전에 추천된 메뉴와 최대한 겹치지 않게 한다 | 필수 |
| F10 | 최초 실행 시 온보딩(성별·목표 설정)이 진행된다 | 필수 |
| F11 | 스킬·에이전트가 OpenAI에 연동된다 (방식은 구현 시 결정) | 필수 |

### 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NF1 | 모든 데이터는 기기 로컬(IndexedDB)에만 저장 — 서버 없음 |
| NF2 | OpenAI API 키는 서버사이드(API Route)에서만 사용 |
| NF3 | Playwright 시각 회귀 테스트로 UI 변경 검증 후 머지 |
| NF4 | PWA 오프라인 지원 (AI 채팅 제외) |
| NF5 | 다른 gugbab 앱과 동일한 코드 컨벤션 (Biome, @gugbab/biome-config) |

---

## 2. 설계 (Design)

### 아키텍처 개요

```
[클라이언트 - Next.js App Router]
  ├── /app
  │   ├── page.tsx              → 식단 채팅 (메인)
  │   ├── ingredients/page.tsx  → 식재료 관리
  │   ├── body/page.tsx         → 신체 지표
  │   ├── settings/page.tsx     → 설정
  │   └── onboarding/page.tsx   → 온보딩
  │
  ├── /api
  │   └── chat/route.ts         → OpenAI 호출 (서버사이드)
  │
  ├── /lib
  │   ├── db/                   → IndexedDB stores (idb)
  │   ├── ai/                   → AI context 조합, 스킬 연동
  │   └── skills/               → .claude/skills 파싱 로직
  │
  └── /components
      ├── layout/               → 하단 네비게이션, 레이아웃
      ├── chat/                 → 채팅 UI 컴포넌트
      ├── ingredients/          → 식재료 컴포넌트
      ├── body/                 → 신체 지표·그래프 컴포넌트
      └── onboarding/           → 온보딩 스텝 컴포넌트

[서버사이드 - Next.js API Route]
  └── /api/chat → OpenAI SDK → 스트리밍 응답

[외부]
  └── OpenAI API
```

### 데이터 모델

```typescript
// 사용자 프로필
interface UserProfile {
  id: string
  gender: 'male' | 'female'
  goals: Goal[]
  createdAt: string
}

type Goal = 'weight-loss' | 'weight-gain' | 'maintain' | 'bulk' | 'lean-mass' | 'health'

// 식재료
interface Ingredient {
  id: string
  name: string
  category: IngredientCategory
  addedAt: string
}

type IngredientCategory = 'vegetable' | 'protein' | 'carbs' | 'dairy' | 'seasoning' | 'etc'

// 신체 지표
interface BodyMetric {
  id: string
  date: string
  weight: number              // kg
  bodyFatPct?: number         // %
  skeletalMuscleMass?: number // kg
}

// 식단 채팅 세션
interface MealSession {
  id: string
  date: string
  messages: ChatMessage[]
  summary?: string            // AI가 생성한 오늘 식단 요약
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}
```

### AI context 조합 로직

```
매 채팅 요청 시 system prompt 구성:

1. 사용자 프로필 (성별, 목표)
2. 최근 신체 지표 최대 3개 + 변화율 계산
3. 현재 식재료 목록 전체
4. 최근 7일 식단 이력 요약 (중복 방지)
5. 스킬 내용 또는 function definitions (A/B 방식에 따라)
```

### 스킬·에이전트 연동 (미결정 — 구현 시 선택)

**방식 A: 시스템 프롬프트 주입**
```
/lib/ai/buildSystemPrompt.ts
  → .claude/skills/ 파일 읽기
  → 관련 스킬 내용 텍스트로 system prompt에 포함
```

**방식 B: OpenAI Function Calling**
```
/lib/skills/parseSkillToFunction.ts
  → SKILL.md 파싱 → OpenAI FunctionDefinition 변환
  → /api/chat에서 tools: [...] 로 전달
  → AI가 필요 시 function 호출 → 결과 포함해 응답
```

---

## 3. 구현 단계 (Tasks)

→ 상세 TODO: `docs/planning/todo.md` 참조

**Phase 0** ✅ 기획·설계 완료  
**Phase 1** ⬜ 프로젝트 셋업  
**Phase 2** ⬜ 핵심 기능 구현 (온보딩·식재료·신체지표·설정)  
**Phase 3** ⬜ AI 식단 채팅 구현  
**Phase 4** ⬜ 시각 회귀 테스트 및 QA  
**Phase 5** 🔒 고도화 (추후)

---

## 4. 열린 질문

| 질문 | 결정 시점 |
|------|----------|
| AI 연동 방식: A(프롬프트 주입) vs B(Function Calling) | Phase 3 시작 시 사용자에게 재질문 |
| 신체지표 그래프 라이브러리 | Phase 2-3 구현 시 |
| 식재료 자동 카테고리 분류 (규칙 vs AI) | Phase 2-2 구현 시 |
