# SQL

목표: 사용자 입력이 SQL 구조가 되지 않는다.

이 템플릿은 SQLAlchemy ORM(`select().where(col == param)`)만 쓴다 — 기본적으로 파라미터 바인딩이라 안전하다.
**위험은 ORM 을 벗어나는 자리**에만 있다.

## 체크리스트

- [ ] `text(...)` 에 f-string·`%`·`.format()`·문자열 연결로 값을 넣지 않는다 — 값은 `text("... :x").bindparams(x=...)`.
      Grep: `text\(f"`, `text\(".*"\s*%`, `\.format\(` 근처의 `execute`
- [ ] **정렬·필터 컬럼을 사용자 입력으로 받으면 화이트리스트로 매핑한다** — `getattr(Model, request.sort)` 나
      `order_by(text(sort))` 는 ❌. `{"created": Model.created_at, ...}[sort]` 처럼
- [ ] `like` 검색에 사용자 입력을 넣을 때 `%`·`_` 를 이스케이프한다 (주입은 아니지만 전체 스캔·우회) — ⚠️
- [ ] 페이지 크기 상한 — `core/utils/pagination.py` 의 `MAX_PAGE_SIZE` 를 거친다 (거대한 `size` 로 DB 를 긁지 않게)
- [ ] 마이그레이션 스크립트의 raw SQL 도 같은 규칙

## 이미 되어 있는 것

- `main.py` 의 `text("SELECT 1")` 은 상수 — 지적하지 않는다
