# nginx · 보안 헤더

목표: HTML 페이지가 다른 사이트에 iframe 으로 들어가지 않고(클릭재킹), HTTPS 가 강제되고, 브라우저가 타입을 추측하지 않는다.

## 어디를 보나

- `deploy/site.conf` — server 블록의 `add_header`, 각 `location` 의 `add_header`
- `deploy/nginx.conf` — real IP·프록시 헤더
- `backend/app/core/middleware/security.py` — API 응답의 보안 헤더

## ⚠️ nginx 의 함정 — `add_header` 상속

**`location` 안에 `add_header` 가 하나라도 있으면 server 레벨의 `add_header` 가 그 location 에서 전부 사라진다.**
캐시 헤더 하나를 넣었을 뿐인데 그 경로에서 X-Frame-Options·HSTS·nosniff 가 빠진다.

- [ ] `add_header` 가 있는 location 마다(`= /index.html`, `/assets/`, `/media/` 등) 보안 헤더를 **다시** 적었거나
      공통 파일을 `include` 한다. 아니면 ❌ — SPA 는 모든 페이지가 `/index.html` 이라 관리자 화면까지 클릭재킹 대상이 된다
- [ ] 확인은 배포된 곳에서 `curl -sI https://<도메인>/admin` 과 `curl -sI https://<도메인>/assets/<파일>` 로 헤더를 본다

## 체크리스트

- [ ] HTML 응답: `X-Frame-Options: SAMEORIGIN`(또는 CSP `frame-ancestors`), `X-Content-Type-Options: nosniff`,
      `Strict-Transport-Security`, `Referrer-Policy`
- [ ] HTTP → HTTPS 리다이렉트가 있다 (없으면 Secure 쿠키가 안 저장된다 — 루트 CLAUDE.md "배포")
- [ ] `.env`·`.git` 같은 파일 요청이 막힌다 (`location ~* (\.env|\.git…) { deny all; }`)
- [ ] `location /api/auth` 에 로그인용 빈도 제한이 붙어 있다 (`/auth` 로 적으면 안 걸린다)
- [ ] 레거시 `X-XSS-Protection: 1; mode=block` 은 오히려 해가 될 수 있다 — `0` 이나 제거 권장 (⚠️)
- [ ] `edge=aws` 면 nginx 가 `CF-Connecting-IP` 를 덮어쓴다 (`edge-realip.conf`). 지우면 레이트리밋 우회 ❌
