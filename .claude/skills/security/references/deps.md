# 의존성 취약점

명령을 돌릴 수 있는 쪽(/verify 의 메인)이 한다. 네트워크가 필요하다.

## 명령

```bash
# 백엔드 — 운영 의존성만 (dev 그룹 제외)
cd backend && uv export --format requirements-txt --no-hashes --no-dev --no-emit-project -o <임시파일>
uvx pip-audit -r <임시파일> --progress-spinner off

# 프론트 — 운영 의존성 / 전체
cd frontend && npm audit --omit=dev
cd frontend && npm audit
```

## 판단

- **운영 의존성의 high·critical 은 ❌.** 고친 버전이 있으면 올린다 (`uv lock --upgrade-package <이름>` / `npm install <이름>@<버전>`)
- 권고문을 읽고 **이 템플릿의 사용 방식에 해당하는지** 한 줄 적는다 — 예: react-router 의 RSC 모드 취약점은
  SPA 로만 쓰면 직접 영향이 낮다. 해당하지 않아도 고친 버전이 있으면 올리는 걸 기본으로 한다
- dev 의존성만의 취약점은 ⚠️ (빌드·테스트 도구라 운영 서버에 안 올라간다)
- 고친 버전이 없으면 우회(해당 기능 미사용·설정)를 적고 ⚠️
- 올린 뒤에는 전체 검증 명령(pytest·vitest·build)을 다시 돌린다
