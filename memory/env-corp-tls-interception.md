---
name: env-corp-tls-interception
description: 회사망(lfcorp) TLS 인터셉션 때문에 로컬 Node fetch가 외부 HTTPS에 실패 — NODE_EXTRA_CA_CERTS 또는 로컬 relay로 우회
metadata: 
  node_type: memory
  type: project
  originSessionId: 129f65e5-2b78-4b68-a65e-571f8f9d9d0e
---

이 개발 머신은 회사망(lfcorp) 보안 장비가 외부 HTTPS를 가로채 재서명한다(발급자 `C=KR, O=lfcorp, CN=www.lfcorp.com`).

- **증상**: Node(undici) `fetch`가 `SELF_SIGNED_CERT_IN_CHAIN`으로 실패. curl은 macOS 키체인을 쓰므로 정상 — "curl은 되는데 앱은 안 됨" 패턴이면 이것부터 의심.
- **우회 1 (검증됨, 2026-07-06)**: 인터셉트 루트 CA를 추출해 `NODE_EXTRA_CA_CERTS`로 지정 후 dev 서버 실행.
  ```bash
  echo | openssl s_client -connect <host>:443 -showcerts 2>/dev/null \
    | awk '/BEGIN CERT/{n++} n==2{print} /END CERT/{if(n==2) exit}' > /tmp/lfcorp-ca.pem
  NODE_EXTRA_CA_CERTS=/tmp/lfcorp-ca.pem pnpm dev
  ```
- **우회 2**: gugbab-claude-relay를 로컬로 띄우고(`http://localhost:3000`) `RELAY_URL`을 로컬로 지정 — HTTP라 TLS 문제 없음.
- **주의**: 로컬 relay가 3000을 선점하면 health dev 서버는 3001에 뜬다. 스모크 테스트 시 포트 확인 필수 (3000에 요청하면 relay가 직접 응답해 401이 나옴).
- Vercel 배포 환경에는 이 문제가 없다 — 로컬 개발 전용 이슈.

관련: [[project-gugbab-health]]
