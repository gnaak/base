"""업로드 파일 저장.

`settings.MEDIA_ROOT` 아래에 저장하고, `main.py`가 `/media`로 서빙한다.

네 가지를 반드시 지킨다.

1. **확장자 화이트리스트** — 블랙리스트는 빠뜨린 것이 곧 구멍이다
2. **내용이 확장자와 맞는지** — 파일 앞부분(매직 바이트)을 본다. `evil.html` 을 `a.png` 로 이름만 바꿔
   올리는 걸 막는다 (`/media` 는 공개 경로라, 브라우저가 내용을 추측하면 같은 오리진에서 스크립트가 돈다)
3. **용량 제한** — 스트리밍으로 세면서 넘으면 즉시 중단한다
   (`await file.read()`로 통째로 읽으면 10GB 업로드가 메모리를 먹는다)
4. **파일명을 새로 만든다** — 클라이언트가 보낸 이름을 쓰면 `../../etc/passwd`
   같은 경로 조작과 이름 충돌이 생긴다. 확장자만 가져오고 본체는 UUID로 바꾼다
"""
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config.settings import settings
from app.core.logging import get_logger
from app.core.utils.error_code import ErrorCode
from app.core.utils.response import fail

logger = get_logger(__name__)

#: 확장자 → 허용 여부. 필요하면 프로젝트에서 늘린다.
IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"})
DOCUMENT_EXTENSIONS = frozenset({".pdf", ".csv", ".xlsx", ".docx", ".txt"})

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
_CHUNK = 1024 * 1024

#: 확장자 → 파일이 이렇게 시작해야 한다. 확장자를 늘리면 여기도 늘린다 (없으면 거부된다).
_ZIP = (b"PK\x03\x04",)  # xlsx·docx 는 zip 이다
_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".gif": (b"GIF87a", b"GIF89a"),
    ".pdf": (b"%PDF-",),
    ".xlsx": _ZIP,
    ".docx": _ZIP,
}
_TEXT_EXTENSIONS = frozenset({".csv", ".txt"})


def _matches_signature(suffix: str, head: bytes) -> bool:
    """파일 앞부분이 확장자와 맞는지. 모르는 확장자는 False (허용 목록에 넣었으면 여기도 넣을 것)."""
    if suffix in _SIGNATURES:
        return head.startswith(_SIGNATURES[suffix])
    if suffix == ".webp":  # RIFF····WEBP
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    if suffix == ".avif":  # ····ftypavif / ftypavis
        return head[4:8] == b"ftyp" and head[8:12] in (b"avif", b"avis")
    if suffix in _TEXT_EXTENSIONS:
        return b"\x00" not in head  # 텍스트에 NUL 이 있으면 바이너리다
    return False


def _safe_suffix(filename: str | None, allowed: frozenset[str]) -> str:
    """확장자만 꺼내서 검증한다. 경로 성분은 전부 버린다."""
    # PurePath 대신 Path(...).name 으로 디렉토리 성분을 먼저 떨어뜨린다
    name = Path(filename or "").name
    suffix = Path(name).suffix.lower()

    if suffix not in allowed:
        fail(
            f"허용되지 않는 형식입니다 ({suffix or '확장자 없음'})",
            ErrorCode.FILE_TYPE_NOT_ALLOWED,
            400,
        )
    return suffix


async def save_upload(
    file: UploadFile,
    subdir: str = "",
    *,
    allowed: frozenset[str] | None = None,
    max_bytes: int | None = None,
) -> str:
    """파일을 저장하고 **공개 URL 경로**(`/media/...`)를 돌려준다.

    DB에는 이 반환값을 그대로 넣으면 된다.

    ⚠️ 기본값을 `= MAX_UPLOAD_BYTES` 로 쓰지 않는 이유 — 기본 인자는 import 시점에
    한 번 평가돼서 모듈 상수를 나중에 바꿔도 반영되지 않는다. `None`으로 받고
    **호출 시점에** 읽어야 설정 변경과 테스트가 실제로 먹는다.
    """
    allowed = allowed if allowed is not None else IMAGE_EXTENSIONS
    max_bytes = max_bytes if max_bytes is not None else MAX_UPLOAD_BYTES
    if file is None or not file.filename:
        fail("파일이 없습니다", ErrorCode.FILE_REQUIRED, 400)

    suffix = _safe_suffix(file.filename, allowed)

    # subdir 도 클라이언트가 못 정하게 한다 (경로 조작 방지). 호출부가 상수로 넘길 것.
    safe_subdir = Path(subdir).name if subdir else ""
    target_dir = Path(settings.MEDIA_ROOT) / safe_subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}{suffix}"
    target = target_dir / stored_name

    written = 0
    try:
        with target.open("wb") as out:
            while chunk := await file.read(_CHUNK):
                if written == 0 and not _matches_signature(suffix, chunk[:16]):
                    out.close()
                    target.unlink(missing_ok=True)
                    fail(
                        f"파일 내용이 확장자({suffix})와 맞지 않습니다",
                        ErrorCode.FILE_TYPE_NOT_ALLOWED,
                        400,
                    )
                written += len(chunk)
                if written > max_bytes:
                    # 넘은 시점에 바로 끊는다 — 끝까지 받고 나서 거절하면 의미가 없다
                    out.close()
                    target.unlink(missing_ok=True)
                    fail(
                        f"파일이 너무 큽니다 (최대 {max_bytes // (1024 * 1024)}MB)",
                        ErrorCode.FILE_TOO_LARGE,
                        413,
                    )
                out.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)  # 반쯤 쓰인 파일을 남기지 않는다
        raise
    finally:
        await file.close()

    if written == 0:
        target.unlink(missing_ok=True)
        fail("빈 파일입니다", ErrorCode.FILE_REQUIRED, 400)

    logger.info("업로드 저장: %s (%d bytes)", stored_name, written)

    url_path = f"/media/{safe_subdir}/{stored_name}" if safe_subdir else f"/media/{stored_name}"
    return url_path
