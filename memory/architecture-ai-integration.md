---
name: architecture-ai-integration
description: "AI 통합 아키텍처 — OpenAI 기반, 스킬·에이전트를 OpenAI tools로 노출 (핵심 요구사항)"
metadata: 
  node_type: memory
  type: project
  originSessionId: b9edb9ce-c780-4548-aaac-3b9201f65045
---

## AI 제공자

- **현재**: OpenAI (GPT) — dream 앱과 동일한 SDK 패턴
- **미래**: Claude(Anthropic)로 전환 가능성 있음 → 추상화 레이어 고려

## 핵심 요구사항 ⚠️

**사용자의 스킬(.claude/skills/)과 에이전트(.claude/agents/)를 OpenAI가 사용할 수 있게 노출해야 한다.**

이것은 단순 AI 호출이 아니라 기존 gugbab 워크플로우 자산을 OpenAI function calling tools로 연결하는 것.

**구현 방향 (확정 전):**
- 스킬/에이전트 MD 파일을 파싱해서 OpenAI function definition으로 변환
- 또는 MCP(Model Context Protocol) 서버를 통해 OpenAI에 노출
- 또는 API 라우트에서 스킬 내용을 system prompt로 주입

**Why:** 사용자가 Claude Code에서 쌓아온 스킬·에이전트 자산을 앱에서도 재사용하고 싶음.
**How to apply:** 설계 시 OpenAI function calling 또는 MCP 연동 구조를 반드시 포함. AI 제공자 추상화 레이어 설계 필수.
