# Memory Index

- [프로젝트 개요](project-gugbab-health.md) — gugbab-health 앱: 식료품 등록 + 신체 지표 기반 식단 자동 설계 앱 (Phase 2 완료)
- [사용자 선호도](user-preferences.md) — 대화 기록 메모리 저장, 브라우저 시각 자료 사용, 단계적 설계 진행 방식 선호
- [기술스택 레퍼런스](project-stack-reference.md) — gugbab 앱 공통 패턴: Vite or Next.js + Biome + Playwright + pnpm + Vercel
- [AI 통합 아키텍처](architecture-ai-integration.md) — OpenAI 기반, 스킬·에이전트를 OpenAI tools로 노출 ⚠️ 핵심 요구사항
- [커밋·푸시 규율](feedback-commit-push-discipline.md) — 명시적 요청 없이 절대 실행 금지, 퍼미션 프롬프트 승인도 요청 대체 불가
- [완료 보고 전 검증 의무](feedback-e2e-verification-before-report.md) — CI/CD 플로우 등 크리티컬 패스는 직접 검증 후 보고
- [회사망 TLS 인터셉션](env-corp-tls-interception.md) — 로컬 Node fetch가 외부 HTTPS 실패 시 NODE_EXTRA_CA_CERTS 우회, relay 로컬은 :3000
