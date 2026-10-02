---
name: env-codex-model-unavailable
description: codex 적대적 리뷰가 gpt-5.4 모델 미지원 400으로 실행 불가 (2026-10-01 감지)
metadata:
  type: reference
---

2026-10-01 기준 codex 적대적 리뷰가 **실행되지 않는다**.

```
400 invalid_request_error:
"The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account."
```

`~/.codex/config.toml`의 `model = "gpt-5.4"`가 ChatGPT 계정에서 지원되지 않는다.
컴패니언(`adversarial-review`)과 폴백(`codex review --uncommitted`) **양쪽 모두** 같은
오류라 리뷰 경로가 전부 막힌다. codex-cli 0.146.0.

`.claude/rules/codex-review.md`의 "사용 불가 감지 시" 절차대로 2회 재현 확인 후
`.claude/.codex-unavailable` 마커를 기록했다. 이 마커는 **config.toml 해시와
codex 버전이 일치하는 동안만** 유효하므로, `model`을 바꾸거나 codex를 업데이트하면
자동 무효화되어 다음 Stop부터 리뷰가 다시 요구된다 — 수동 삭제 불필요.

**해소 방법**: `~/.codex/config.toml`의 `model`을 ChatGPT 계정이 지원하는 값으로
변경(예: `gpt-5.1-codex` 계열). 변경 후 마커가 자동 무효화된다.

**영향**: 이 기간의 코드 변경은 Codex 적대적 리뷰 없이 머지된다. 대신 단위 테스트·
타입체크·빌드·실측 검증으로 대체하고, 리뷰가 복구되면 중요 변경은 소급 리뷰를 검토할 것.
