# 파일 업로드

목표: 업로드로 서버에 실행 파일을 두거나, 남의 브라우저에서 스크립트를 돌리거나, 디스크를 채우지 못한다.

## 어디를 보나

- `backend/app/core/utils/upload.py` — 확장자 목록, `MAX_UPLOAD_BYTES`, 저장 경로, 파일명
- `backend/app/module/upload/upload_router.py` — 인증·빈도 제한
- 서빙 — `backend/app/main.py` 의 `/media` StaticFiles, `deploy/site.conf` 의 `location /media/`

## 체크리스트

- [ ] 확장자만이 아니라 **내용(매직 바이트)도 확인한다** — `evil.html` 을 `a.png` 로 올리는 걸 막는다. 확장자만이면 ⚠️
      (SVG·HTML 은 허용 목록에 없어야 한다 — 같은 오리진에서 스크립트가 돈다)
- [ ] 파일명은 서버가 만든다 (UUID) — 사용자 파일명·경로를 저장 경로에 쓰지 않는다 (`../` 경로 이탈)
- [ ] 크기 상한을 스트리밍 중에 센다 (다 받고 나서 재지 않는다). nginx `client_max_body_size` 가 그보다 넉넉하다
- [ ] 업로드 엔드포인트에 인증과 빈도 제한이 있다
- [ ] **`/media` 는 공개다** — 영업신고증·신분증처럼 남이 보면 안 되는 파일을 같은 경로에 두면 ❌. 비공개 파일은 별도 경로 + 인증된 다운로드
- [ ] `/media/` 응답에 `X-Content-Type-Options: nosniff` 가 붙는다 (nginx-headers.md — location 의 add_header 상속 함정)
- [ ] 이미지 EXIF(위치 정보)를 그대로 공개하는지 — 사용자 사진이면 ⚠️
