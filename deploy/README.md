# 배포

> **이 폴더는 설정 파일 원본이다. 자동화 스크립트가 아니다.**
> 실행하는 게 아니라 **서버에 복사해서 쓰는 것**이고, 패키지 설치·프로비저닝은 하지 않는다.
> (그건 AMI·Ansible 등 각자의 방식으로 한다)

EC2 한 대에 nginx(정적 + 프록시) + gunicorn/uvicorn(앱)을 올리는 구성.

| 파일 | 어디로 |
|---|---|
| `nginx.conf` | `/etc/nginx/nginx.conf` 의 `http{}` 블록 (통째로 덮지 말고 필요한 부분만) |
| `site.conf` | `/etc/nginx/sites-available/<도메인>` → `sites-enabled` 에 심볼릭 링크 |
| `fastapi.service` | `/etc/systemd/system/fastapi.service` |

`CHANGE` 표시된 곳만 바꾸면 된다. `/setup` 커맨드가 같이 훑어준다.

**설정값보다 주석이 본체다.** 새 프로젝트마다 다시 밟는 지뢰를 박아뒀다 —
`APP_ENV` 누락, `location /auth` 오타(로그인 레이트리밋이 조용히 미적용),
`X-Forwarded-For` 누락(전 방문자가 한 한도에 묶임), `client_max_body_size` 와
앱 업로드 한도의 불일치, `--workers` 를 올렸을 때의 로그 충돌 등.

## 전제 (이 폴더가 하지 않는 것)

서버에 아래가 이미 있어야 한다. 커스텀 AMI 를 쓴다면 거기 포함돼 있을 것이다.

- nginx
- Python 3.12+ 과 `backend/.venv` (의존성 설치 완료)
- Node 20+ (프론트를 서버에서 빌드한다면)
- MySQL · Redis 접근 (같은 서버든 RDS/ElastiCache 든)

> ⚠️ 보안그룹에서 **8000 번을 열지 말 것.** 앱은 `127.0.0.1` 에만 바인딩하고
> nginx 만 붙는다. 외부에 열면 `--forwarded-allow-ips` 가 곧바로 구멍이 된다.

### 배포판 — 이 파일들은 Ubuntu 기준이다

Amazon Linux · RHEL 계열이면 아래를 바꿔야 한다.

| | Ubuntu / Debian | Amazon Linux · RHEL |
|---|---|---|
| nginx 설정 구조 | `sites-available` + `sites-enabled` | **없다** — `site.conf` 를 `/etc/nginx/conf.d/` 에 |
| nginx 실행 유저 | `www-data` | `nginx` |
| 기본 SSH 유저 | `ubuntu` | `ec2-user` |

---

## 0. 먼저 정할 것 — TLS 를 누가 끝내는가

여기서 나머지가 전부 갈린다.

| 배포 형태 | TLS 종단 | nginx 포트 | HTTP→HTTPS 리다이렉트 | 서버 인증서 |
|---|---|---|---|---|
| **Cloudflare (Flexible)** | CF | 80 | CF 대시보드 | 불필요 |
| **Cloudflare (Full strict)** | CF + origin | 80·443 | nginx | CF Origin Certificate (무료·15년) |
| **AWS ALB + ACM** | ALB | 80 | ALB 리스너 규칙 | 불필요 (ACM 이 ALB 에) |
| **EC2 직접** | nginx | 80·443 | nginx | certbot |

### ⚠️ 어느 형태든 반드시 확인할 것

**HTTP 로 접속했을 때 HTTPS 로 리다이렉트되는가.**

```bash
curl -sSI http://example.com | head -1
# HTTP/1.1 301 ...  ← 이래야 한다
# HTTP/1.1 200 ...  ← 이러면 문제
```

200 이 나오면 평문 HTTP 로도 사이트가 열린다는 뜻이고, 이 템플릿의 쿠키는 운영에서
`Secure` 라 **브라우저가 저장을 거부한다.** 증상은 "로그인은 200 인데 세션이 안 잡힘" 이다.

앞단이 TLS 를 끝내는 구성(Cloudflare Flexible·ALB)에서는 nginx 가 이걸 모르므로
**앞단에서 켜야 한다**:

- Cloudflare — SSL/TLS → Edge Certificates → **Always Use HTTPS: On**
- ALB — 80 리스너 → Redirect to HTTPS (443)

> **Cloudflare Flexible 은 CF↔서버 구간이 평문이다.** 비밀번호와 세션 쿠키가
> 공용 인터넷을 평문으로 지나간다. 가능하면 Origin Certificate 를 깔고
> **Full (strict)** 로 올릴 것. 순서 중요 — **인증서를 먼저 깔고** 모드를 바꾼다.
> 반대로 하면 CF 가 443 으로 붙는데 nginx 가 안 듣고 있어서 사이트가 죽는다.

---

## 1. 배포 순서

```bash
# 코드
git pull
cd backend && pip install -r requirements.txt        # requirements-dev 는 제외
cd frontend && npm ci && npm run build               # → frontend/dist

# 마이그레이션 (리비전 생성은 로컬에서만. 서버는 적용만)
cd backend && APP_ENV=prod sh migrate_server.sh

# 재시작
sudo systemctl restart fastapi
sudo nginx -t && sudo systemctl reload nginx
```

## 2. 배포 후 확인 — 이 네 줄은 매번

```bash
# ① 앱이 어떤 환경으로 떴는가
sudo journalctl -u fastapi -n 30 | grep '설정:'
#   설정: env=prod (근거: APP_ENV) | ...      ← 이래야 한다
#   근거: hostname 추측                        ← APP_ENV 가 안 먹고 있다

# ② 헬스체크
curl -sS https://example.com/api/health

# ③ HTTP 리다이렉트 (위 0번 참고)
curl -sSI http://example.com | head -1

# ④ 레이트리밋이 IP 를 제대로 구분하는가 — 응답 헤더의 request-id 로 추적
curl -sSI https://example.com/api/health | grep -i x-request-id
```

`①` 에서 `env=local` 이 나오면 **쿠키가 `secure=False`·`SameSite=Lax` 로 나가서
세션이 안 잡힌다.** 다른 걸 보기 전에 이것부터 고칠 것.

---

## 3. 자주 밟는 지뢰

| 증상 | 원인 |
|---|---|
| 로그인 200 인데 세션 안 잡힘 | `APP_ENV` 누락 / HTTP 리다이렉트 없음 / 쿠키 도메인 불일치 |
| 모든 사용자가 한 레이트리밋에 묶임 | `X-Forwarded-For` 프록시 헤더 누락 → 전부 `127.0.0.1` 로 보임 |
| 업로드가 nginx HTML 을 반환 | `client_max_body_size` 가 앱의 `MAX_UPLOAD_BYTES` 보다 작음 |
| 로그인에 빡센 한도가 안 걸림 | `location /auth` 로 적었다 — 실제 라우트는 `/api/auth/**` 다 |
| 배포했는데 옛 화면 | `index.html` 이 캐시됨 — `no-store` 확인 |
| WebSocket 이 5분마다 끊김 | `/api/ws` 의 `proxy_read_timeout` 이 기본값(300s) |
| 재부팅 후 앱이 죽어 있음 | `After=network-online.target` 누락 → DB 보다 먼저 떠서 fail-fast |

---

## 4. 안 다루는 것

- **무중단 배포** — 지금은 `systemctl restart` 라 수 초 끊긴다.
  필요해지면 소켓 활성화나 blue/green 을 붙인다
- **프론트 컨테이너화** — `frontend/dist` 를 nginx 가 직접 서빙한다
- **멀티 워커** — `--workers 1` 고정. 이유는 `fastapi.service` 주석 참고
- **SSR** — 프리렌더 레시피만 `site.conf` 하단에 있다
