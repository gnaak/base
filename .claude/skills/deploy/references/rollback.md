# 롤백 · 마이그레이션 호환

원문: `infra/README.md` "롤백" · "서버 안 구조", `infra/server/{deploy,rollback,lib}.sh`, `backend/CLAUDE.md` "되돌릴 수 있게 — expand / contract".

## 어떻게 되돌리나 — 고르기

| 상황 | 할 일 |
| --- | --- |
| 배포가 확인(헬스 · `근거: APP_ENV` · nginx 경유)에 실패했다 | **이미 자동으로 이전 릴리스로 돌아가 있다.** CI 는 빨갛다. 원인을 고쳐 다시 푸시 |
| 배포는 성공했는데 나중에 문제가 보인다 · 급하다 | `rollback.sh` — 서버에 남은 릴리스(최근 3개)로 current 만 바꾼다. 수 초 |
| 코드로 되돌리고 싶다 | `git revert` → 푸시 (평소 배포). **단 마이그레이션이 든 커밋은 revert 하지 않는다 → forward-fix** |
| 그 사이 Parameter Store 값을 바꿨다 (비번 교체 등) | 롤백한 릴리스의 `.env` 는 그 배포 때 것이라 옛 값이다 → 롤백 대신 이전 커밋을 다시 배포 |

## rollback.sh 부르기 — 사람이 요청했을 때만

먼저 무엇으로 돌아갈지 보여주고 확인받는다 (`--list`). 실행은 사람이 하거나, 요청받았을 때 대신 명령을 낸다.

```bash
# 남은 릴리스 (current 표시)
aws ssm send-command --instance-ids <instance_id> --document-name AWS-RunShellScript \
  --parameters 'commands=["bash /srv/app/current/infra/server/rollback.sh --list"]'
# 바로 전 릴리스로 / 골라서
... 'commands=["bash /srv/app/current/infra/server/rollback.sh"]'
... 'commands=["bash /srv/app/current/infra/server/rollback.sh 20261003-111138-bbbbbbbbbbbb"]'
# 결과
aws ssm get-command-invocation --command-id <CommandId> --instance-id <instance_id>
```

`instance_id` 는 `./infra/tf.ps1 output` 또는 GitHub Variables. Session Manager 로 들어가 `sudo bash …/rollback.sh` 도 같다.

## 되돌리기 전에 확인할 것

1. **그 사이 마이그레이션이 있었나** — `git log <돌아갈 릴리스의 sha>..<지금 sha> -- backend/alembic/versions/`.
   있었다면 이전 코드가 **새 스키마 위에서** 돈다. expand 만 한 마이그레이션(컬럼 추가 · nullable)이면 괜찮고,
   컬럼 삭제 · 이름 변경 · NOT NULL 추가가 있었다면 이전 코드가 깨진다 → 롤백 말고 forward-fix
2. **돌아갈 릴리스가 남아 있나** — 최근 3개만 있다 (`--list`). 더 오래된 건 이전 커밋을 다시 배포
3. **다음 main 푸시가 다시 최신을 배포한다** — 롤백은 고칠 때까지 버티는 용도다. 사람에게 그렇게 말해 둔다

## 마이그레이션을 이전 코드와 맞게 — 리뷰할 때 보는 것

| 보이면 | 판정 |
| --- | --- |
| `add_column(..., nullable=True)` 또는 `server_default` 있음 | ✅ expand |
| `add_column(..., nullable=False)` 이고 기본값 없음 | ❌ 이전 코드의 INSERT 가 실패한다 |
| `drop_column` · `drop_table` | ❌ 같은 릴리스에서 코드가 막 그걸 안 쓰게 된 거라면 다음 릴리스로 미룬다 |
| `alter_column` 으로 이름 변경 · 타입 좁히기 · `nullable=False` | ❌ 새 컬럼 추가 → 이중 쓰기 → 다음 릴리스에서 정리 |
| 마이그레이션이 든 커밋을 revert | ❌ 리비전 파일이 사라져 `alembic upgrade` 가 멈춘다 |

## 예전 구조 서버 (/srv/app 에 바로 풀던 것)

릴리스 구조로 바뀌는 첫 배포가 한 번 자동 전환한다 — 로그 · 업로드는 `shared/` 로, 그 배포가 성공하면 옛 파일은
`/srv/app/legacy-<시각>/`(지우지 않는다). 첫 배포가 실패하면 예전 구조 그대로 되돌린다. 그 뒤로는 `rollback.sh` 가 릴리스끼리만 오간다.
