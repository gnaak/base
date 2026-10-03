# 빼기 — Docker (로컬 전용)

**사람이 요청할 때만.** Docker 는 로컬 MySQL 을 띄우는 데만 쓴다 — 운영(EC2 에 직접 설치)과 CI(Actions 서비스 컨테이너)는 쓰지 않는다.
처음 쓰는 사람의 셋업 경로(`/start` 의 "MySQL 이 없으면 Docker")가 여기에 기대고 있어서, 빼면 그 경로를 "직접 설치"로 바꿔야 한다.
Redis 는 이미 Docker 가 필요 없다 (`local_redis_host=memory`).

## 파일

| 파일 | 할 일 |
| --- | --- |
| `docker-compose.yml` | 삭제 |
| `docker/` | 폴더 삭제 (`mysql/init.sql` — DB 3개를 만들던 것. 대신 `prepare_local databases`) |
| `.github/workflows/ci.yml` | 서비스 컨테이너 주석 "docker-compose.yml 과 같은 이미지·같은 healthcheck" 문구만 |
| `docs/guides/03-docker.html` | 삭제. `index.html` 의 03 링크와 04 링크 문구("Docker 없이 … Docker 를 못 쓰는 PC 일 때만" → "MySQL 직접 설치") · `04-mysql-redis.html` 의 Docker 안내 · `img/README.md` 의 03-* 행 · `guide.js` 예시 이름 |

## `/start` · `/setup` · README — 대신할 명령을 적는다

`docker compose up -d` 가 하던 일은 **`PP check` → `PP databases db_{slug} db_{slug}_test db_{slug}_e2e`** 다
(`PP` = `uv --directory backend run python -m scripts.prepare_local`).

| 파일 | 할 일 |
| --- | --- |
| `.claude/commands/start.md` | "템플릿 이름 바꾸기"의 `docker/mysql/init.sql` · `docker-compose.yml` 항목 · PATH 의 Docker 경로 · 보고 표의 "Docker 로 띄웠는지" |
| 〃 MySQL "접속 안 됨" | Docker 설치 · 켜기 단계 전체 → `docs/guides/04-mysql-redis.html`(직접 설치)을 열고 AskUserQuestion [다 했어요 / 막혔어요] |
| 〃 MySQL "비밀번호가 필요하다" | 선택지 "모르겠어요 → Docker 에 새로 띄우기" 와 4번(`MYSQL_PORT=3307` · `PP set mysql_port 3307` · 비밀번호 비우기) → "모르겠어요" 면 MySQL 공식 비밀번호 재설정 안내(https://dev.mysql.com/doc/refman/8.0/en/resetting-permissions.html)를 열고 멈춘다 — 사람이 정한다 |
| `.claude/commands/setup.md` | DB 이름 맞추는 목록의 `init.sql` · `docker compose up` → 위 대신할 명령 |
| `README.md` | 시작하기의 `docker compose up -d` · 루트 `.env` 의 `MYSQL_PORT` 안내 · 구조의 `docker/` · 체크리스트의 `init.sql` |
| `CLAUDE.md` | 로컬 절의 `docker compose up -d` · 새 프로젝트 표의 `init.sql` |
| `frontend/CLAUDE.md` | E2E DB 줄의 "compose 면 이미 있다" |

## 남겨 두는 것 — 로컬 compose 가 아니라 운영 이야기

`CLAUDE.md` 기술 스택의 "Docker 없이 nginx · systemd" · `settings.py` · `logging/config.py` · `run_server.sh` 의 Docker · Cloud Run 언급 ·
`ci.yml` 의 "Docker 는 배포에 쓰지 않는다" · `infra/README.md` 의 `| Docker | 안 씀 |`

⚠️ 로컬 Docker 로 `nginx -t` 를 돌려 보던 습관(need.md)도 같이 사라진다 — nginx 를 고친 뒤에는 첫 배포 로그로 확인한다.

## 확인

```bash
git grep --untracked -n -i -E "docker|compose" -- . ':!CHANGELOG.md' ':!need.md' ':!backend/uv.lock' ':!frontend/package-lock.json' ':!.claude/skills/modules' \
  | grep -v -E "Cloud Run|로그 드라이버|Docker 없이 nginx|배포에 쓰지 않는다|\| Docker \| 안 씀"
```

남은 줄이 운영 이야기면 보고에 적고 둔다. 마지막으로 `/start` 를 막 받은 폴더에서 한 번 — MySQL 이 없는 경우의 안내가 끊기지 않는지 (사람이 본다).
