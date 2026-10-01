"""POST /api/upload/image — 확장자·용량·경로 조작 방어.

⚠️ 이 테스트는 실제로 `settings.MEDIA_ROOT` 에 파일을 쓴다.
   `media_root` 픽스처가 매 테스트마다 임시 폴더로 갈아끼워서 저장소를 더럽히지 않는다.
"""
from pathlib import Path

import pytest

from app.core.config.settings import settings
from app.core.utils import upload as up
from tests.conftest import auth_header

URL = "/api/upload/image"

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture
def media_root(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "MEDIA_ROOT", tmp_path)
    return tmp_path


def _file(name="a.png", content=PNG, mime="image/png"):
    return {"file": (name, content, mime)}


# ──────────────────────────────────────────────────────────────
#  정상 경로
# ──────────────────────────────────────────────────────────────
async def test_이미지를_올리면_경로를_돌려준다(client, make_user, media_root):
    user = await make_user()

    res = await client.post(URL, files=_file(), headers=auth_header(user.id))

    assert res.status_code == 200
    url = res.json()["data"]["url"]
    assert url.startswith("/media/image/")
    assert url.endswith(".png")


async def test_파일명을_새로_만든다(client, make_user, media_root):
    """클라이언트가 보낸 이름을 그대로 쓰면 경로 조작과 이름 충돌이 생긴다."""
    user = await make_user()

    res = await client.post(URL, files=_file(name="원본이름.png"), headers=auth_header(user.id))

    assert "원본이름" not in res.json()["data"]["url"]


async def test_같은_이름을_두_번_올려도_덮어쓰지_않는다(client, make_user, media_root):
    user = await make_user()

    a = await client.post(URL, files=_file(), headers=auth_header(user.id))
    b = await client.post(URL, files=_file(), headers=auth_header(user.id))

    assert a.json()["data"]["url"] != b.json()["data"]["url"]
    assert len(list((media_root / "image").iterdir())) == 2


# ──────────────────────────────────────────────────────────────
#  방어
# ──────────────────────────────────────────────────────────────
async def test_허용되지_않은_확장자는_거부한다(client, make_user, media_root):
    user = await make_user()

    res = await client.post(
        URL, files=_file(name="evil.svg", mime="image/svg+xml"), headers=auth_header(user.id)
    )

    assert res.status_code == 400
    assert res.json()["errorCode"] == "FILE_TYPE_NOT_ALLOWED"


async def test_확장자가_없으면_거부한다(client, make_user, media_root):
    user = await make_user()

    res = await client.post(URL, files=_file(name="noext"), headers=auth_header(user.id))

    assert res.status_code == 400
    assert res.json()["errorCode"] == "FILE_TYPE_NOT_ALLOWED"


async def test_경로_조작_시도는_이름에서_걸러진다(client, make_user, media_root):
    """`../../evil.png` 같은 이름이 와도 확장자만 취하고 본체는 UUID로 바꾼다."""
    user = await make_user()

    res = await client.post(
        URL, files=_file(name="../../evil.png"), headers=auth_header(user.id)
    )

    assert res.status_code == 200
    # 저장 위치가 media/image 밖으로 나가지 않았다
    saved = list((media_root / "image").iterdir())
    assert len(saved) == 1
    assert Path(saved[0]).parent == media_root / "image"


async def test_용량을_넘으면_413(client, make_user, media_root, monkeypatch):
    """끝까지 받고 나서 거절하면 의미가 없다 — 넘은 시점에 끊는지 확인한다."""
    user = await make_user()
    monkeypatch.setattr(up, "MAX_UPLOAD_BYTES", 1024)

    big = b"\x89PNG\r\n\x1a\n" + b"0" * 5000
    res = await client.post(URL, files=_file(content=big), headers=auth_header(user.id))

    assert res.status_code == 413
    assert res.json()["errorCode"] == "FILE_TOO_LARGE"
    # 반쯤 쓰인 파일을 남기지 않는다
    assert not list((media_root / "image").iterdir())


async def test_로그인하지_않으면_401(client, media_root):
    res = await client.post(URL, files=_file())

    assert res.status_code == 401


# ──────────────────────────────────────────────────────────────
#  내용 검사 — 이름만 바꾼 파일
# ──────────────────────────────────────────────────────────────
async def test_내용이_확장자와_다르면_거부하고_남기지_않는다(client, make_user, media_root):
    """`evil.html` 을 `a.png` 로 이름만 바꿔 올리는 경우. `/media` 는 공개라 같은 오리진에서 열린다."""
    user = await make_user()
    html = b"<html><script>alert(document.cookie)</script></html>"

    res = await client.post(URL, files=_file(name="a.png", content=html), headers=auth_header(user.id))

    assert res.status_code == 400
    assert res.json()["errorCode"] == "FILE_TYPE_NOT_ALLOWED"
    assert not (media_root / "image").exists() or not list((media_root / "image").iterdir())


async def test_빈_파일은_거부한다(client, make_user, media_root):
    user = await make_user()

    res = await client.post(URL, files=_file(content=b""), headers=auth_header(user.id))

    assert res.status_code == 400
    assert res.json()["errorCode"] == "FILE_REQUIRED"


@pytest.mark.parametrize(
    "name, head",
    [
        ("a.jpg", b"\xff\xd8\xff\xe0" + b"0" * 32),
        ("a.gif", b"GIF89a" + b"0" * 32),
        ("a.webp", b"RIFF\x00\x00\x00\x00WEBP" + b"0" * 32),
        ("a.avif", b"\x00\x00\x00\x1cftypavif" + b"0" * 32),
    ],
)
async def test_이미지_형식별_시그니처를_통과한다(client, make_user, media_root, name, head):
    user = await make_user()

    res = await client.post(URL, files=_file(name=name, content=head), headers=auth_header(user.id))

    assert res.status_code == 200, name


@pytest.mark.parametrize(
    "suffix, head, ok",
    [
        (".pdf", b"%PDF-1.7\n", True),
        (".pdf", b"<html>", False),
        (".xlsx", b"PK\x03\x04rest", True),
        (".docx", b"MZ\x90\x00", False),  # exe 를 docx 로
        (".csv", b"name,age\n", True),
        (".txt", b"abc\x00def", False),  # 텍스트에 NUL — 바이너리
        (".exe", b"MZ", False),  # 모르는 확장자는 거부
    ],
)
def test_문서_형식_시그니처(suffix, head, ok):
    assert up._matches_signature(suffix, head) is ok
