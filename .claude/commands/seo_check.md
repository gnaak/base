---
name: seo_check
description: 검색·AI 인용이 조용히 0이 되는 사고를 정적으로 점검. 푸시·배포 전에 사용.
---

$ARGUMENTS

검색·AI 인용 **회귀 검사**를 수행한다. 대화형 전체 감사가 아니라, **"조용히 0이 되는 사고"**
몇 가지만 빠르게 본다. 터미널 명령은 쓰지 말고 파일을 직접 Read/Grep 해서 판단한다.

> `$ARGUMENTS` 에 URL이 주어지면 배포본도 함께 본다 (아래 "배포본 점검").
> 없으면 저장소 파일만 본다.

## 읽을 파일

| 파일 | 없으면 |
| ---- | ------ |
| `frontend/index.html` | 이게 없으면 프론트 구조가 바뀐 것 — 사용자에게 확인 |
| `frontend/public/robots.txt` | 경고 (아직 안 만든 상태) |
| `frontend/public/sitemap.xml` | 경고 |
| `frontend/public/llms.txt` | 경고 |

## 점검 항목

### ❌ 실패로 처리 (조용히 0이 되는 것들)

1. **`index.html` 에 `noindex`** — `<meta name="robots">` 에 `noindex` 가 있으면 배포 시
   검색에서 통째로 사라진다. 스테이징 설정이 운영에 섞이는 사고가 가장 흔하다
2. **`robots.txt` 의 `Disallow: /`** — 사이트 전체 차단
3. **AI 크롤러 차단** — `GPTBot` · `ClaudeBot` · `PerplexityBot` · `OAI-SearchBot` 중
   `Disallow: /` 가 걸린 것이 있는지. 막아놓고 "왜 AI가 인용을 안 하지" 하는 경우가 흔하다.
   `User-agent:` 블록 단위로 읽을 것 — 그 다음 `User-agent:` 가 나오기 전까지가 한 블록이다
4. **`Yeti` 차단** — 네이버 봇. 막히면 네이버 노출이 0이다
5. **`viewport` 없음** — 네이버는 모바일 최적화를 강하게 본다
6. **깨진 JSON-LD** — `application/ld+json` 블록을 꺼내 JSON으로 파싱해 본다.
   파싱이 실패하면 구조화 데이터가 **통째로 무시**되므로, 있는 것보다 나쁠 수 있다

### ⚠️ 경고 (있으면 좋은 것들)

- `robots.txt` / `sitemap.xml` / `llms.txt` 없음
- `<meta name="description">` 없음
- OG 태그(`og:title`·`og:description`·`og:image`) 없음
- `<html lang>` 없음
- `<title>` 이 기본값(`BASE`)에서 안 바뀜 — 새 프로젝트에서 자주 빠뜨린다
- JSON-LD 자체가 없음
- `robots.txt` 에 `/admin` · `/api` `Disallow` 가 없음 (크롤 예산 낭비)
- `sitemap.xml` 에 `/api/health` 같은 인프라 경로가 들어있음

## 배포본 점검 (URL이 주어졌을 때만)

```bash
curl -sIL <URL> | grep -i 'x-robots-tag'      # 헤더 레벨 noindex — HTML만 봐선 못 잡는다
curl -sL <URL> | grep -c '<h1'                 # 크롤러 눈에 본문이 보이는가
curl -sL <URL>/robots.txt
curl -s -o /dev/null -w '%{http_code}' <URL>/없는페이지   # 404가 404인가
```

**`h1` 이 0이어도, 없는 페이지가 404 대신 200을 줘도 — 그 자체로 실패가 아니다.**
이 템플릿의 프론트는 CSR + SPA fallback 이라 **정상 동작**이고, `path="*"` 가
NotFound 화면을 그리므로 사람에게는 문제가 없다.

판단은 **이 서비스가 공개 검색 노출을 목표로 하는지**에 달렸다. 먼저 사용자에게 묻는다:

| 성격 | 200 soft 404 · CSR |
| ---- | ------------------ |
| 관리자 도구 · 사내 도구 · 로그인 뒤 서비스 | 그대로 둔다. 크롤러가 올 일이 없다 |
| 공개 랜딩 · 소개 · 블로그 | 프리렌더로 간다 (soft 404 도 같이 풀린다) |

후자일 때만 `deploy/site.conf` 하단의 프리렌더 절차와
`.claude/skills/seo/SKILL.md` 의 "이 템플릿에서의 출발점" 을 안내한다.

## 보고 형식

```
레인별 결과

| 레인 | 상태 | 근거 |
|---|---|---|
| SEO  | ⚠️ | robots.txt·sitemap.xml 없음 (frontend/public/) |
| GEO  | ⚠️ | llms.txt 없음. AI 크롤러 차단은 없음 |
| AEO  | ⚠️ | JSON-LD 0건 |
| NEO  | ✅ | Yeti 차단 없음, viewport 있음 |

실패 N · 경고 M
```

- 실패·경고마다 **파일과 줄 번호**를 짚는다
- 고칠 것이 있으면 **무엇을 어떻게 고칠지 제안하고 승인을 받는다.** 임의로 고치지 않는다
- 마지막에 범위를 명시한다:

  > 이 검사는 조용히 0이 되는 사고만 봅니다. 콘텐츠 품질·인용 가능성·LLMO(사이트 밖 신호)는
  > 범위 밖이고, 전체 감사는 `/seo` 스킬이 담당합니다.

## 하지 말 것

- 파일을 임의로 생성·수정하지 말 것 (제안 후 승인)
- `noindex` 를 "고치기" 위해 지울 때는 **왜 있었는지 먼저 물을 것** —
  의도적으로 막아둔 스테이징 환경일 수 있다
- `APP_ENV` · 쿠키 설정은 건드리지 말 것 (인증 계약이 깨진다)
