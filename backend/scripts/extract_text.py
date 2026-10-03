"""자료 파일에서 글자만 꺼낸다 — `/start` 가 고객 대화 · 계약서 · 회의 메모를 읽을 때 쓴다.

    uv run --no-project python backend/scripts/extract_text.py PRD/sources/계약서.docx PRD/sources/견적.xlsx

파이썬 표준 라이브러리만 쓴다 — `uv sync` 전(처음 쓰는 PC)에도 돈다. docx · hwpx · xlsx · pptx 는
압축 파일 안의 XML 이라 그대로 읽는다.

| 형식 | 여기서 | 아니면 |
| --- | --- | --- |
| txt · md · csv · json (카카오톡 대화 내보내기 포함) | ✅ | |
| docx · hwpx · xlsx · pptx | ✅ | |
| pdf · png · jpg (캡처) | | Claude 가 Read 로 직접 본다 |
| hwp · doc · xls · ppt (옛 형식) | | 한글 · 오피스에서 PDF 나 새 형식(hwpx · docx …)으로 저장해 달라고 한다 |
"""

import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree

TEXT = {".txt", ".md", ".csv", ".json", ".tsv"}
READ_DIRECTLY = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp"}
OLD_FORMATS = {".hwp": "hwpx 나 PDF", ".doc": "docx 나 PDF", ".xls": "xlsx", ".ppt": "pptx 나 PDF"}


class Unsupported(Exception):
    """여기서 못 읽는 형식 — 메시지에 어떻게 하면 되는지가 있다."""


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _paragraphs(xml: bytes) -> list[str]:
    """`<…:p>` 마다 그 안의 `<…:t>` 글자를 이어 붙인 줄. 표 안의 문단(문단 안의 문단)은 따로 한 줄이 된다.

    docx(w:p · w:t) · hwpx(hp:p · hp:t) · pptx(a:p · a:t) 가 같은 모양이다.
    """
    out: list[str] = []

    def walk(el, buf: list[str]) -> None:
        name = _local(el.tag)
        if name == "p":
            mine: list[str] = []
            for child in el:
                walk(child, mine)
            line = "".join(mine).strip()
            if line:
                out.append(line)
            return
        if name == "t":
            buf.append(el.text or "")
            for child in el:  # hwpx 는 t 안에 줄바꿈 · 탭 요소를 두고 그 뒤에 글자를 이어 쓴다
                buf.append(child.tail or "")
            return
        if name == "tab":
            buf.append("\t")
        for child in el:
            walk(child, buf)

    walk(ElementTree.fromstring(xml), [])
    return out


def _numbered(names: list[str], pattern: str) -> list[str]:
    """section10 이 section2 뒤에 오게 — 숫자 순서로."""
    found = [(int(m.group(1)), n) for n in names if (m := re.fullmatch(pattern, n))]
    return [n for _, n in sorted(found)]


def _docx(z: zipfile.ZipFile) -> str:
    return "\n".join(_paragraphs(z.read("word/document.xml")))


def _hwpx(z: zipfile.ZipFile) -> str:
    sections = _numbered(z.namelist(), r"Contents/section(\d+)\.xml")
    return "\n".join(line for s in sections for line in _paragraphs(z.read(s)))


def _pptx(z: zipfile.ZipFile) -> str:
    slides = _numbered(z.namelist(), r"ppt/slides/slide(\d+)\.xml")
    return "\n\n".join(
        f"[슬라이드 {i}]\n" + "\n".join(_paragraphs(z.read(s))) for i, s in enumerate(slides, 1)
    )


def _xlsx(z: zipfile.ZipFile) -> str:
    shared: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ElementTree.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root:
            shared.append("".join(t.text or "" for t in si.iter() if _local(t.tag) == "t"))

    sheets = _numbered(z.namelist(), r"xl/worksheets/sheet(\d+)\.xml")
    blocks = []
    for i, sheet in enumerate(sheets, 1):
        rows = []
        for row in ElementTree.fromstring(z.read(sheet)).iter():
            if _local(row.tag) != "row":
                continue
            cells = []
            for c in row:
                if _local(c.tag) != "c":
                    continue
                kind = c.get("t")
                if kind == "inlineStr":
                    cells.append("".join(t.text or "" for t in c.iter() if _local(t.tag) == "t"))
                    continue
                v = next((x.text for x in c if _local(x.tag) == "v"), None) or ""
                cells.append(shared[int(v)] if kind == "s" and v.isdigit() and int(v) < len(shared) else v)
            if any(cells):
                rows.append("\t".join(cells))
        blocks.append(f"[시트 {i}]\n" + "\n".join(rows))
    return "\n\n".join(blocks)


ZIPPED = {".docx": _docx, ".hwpx": _hwpx, ".pptx": _pptx, ".xlsx": _xlsx}


def extract(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in TEXT:
        raw = path.read_bytes()
        for encoding in ("utf-8-sig", "cp949"):  # 한글 Windows 에서 저장한 메모는 cp949 일 수 있다
            try:
                return raw.decode(encoding)
            except UnicodeDecodeError:
                continue
        return raw.decode("utf-8", errors="replace")
    if ext in ZIPPED:
        try:
            with zipfile.ZipFile(path) as z:
                return ZIPPED[ext](z)
        except (zipfile.BadZipFile, KeyError, ElementTree.ParseError) as e:
            raise Unsupported(
                f"{path.name}: 파일이 깨졌거나 형식이 다릅니다 ({e}) — PDF 로 저장해 달라고 한다"
            ) from e
    if ext in READ_DIRECTLY:
        raise Unsupported(
            f"{path.name}: Claude 가 Read 로 직접 읽는다 (PDF 는 10쪽이 넘으면 pages 로 나눠서)"
        )
    if ext in OLD_FORMATS:
        raise Unsupported(f"{path.name}: 옛 형식 — {OLD_FORMATS[ext]} 로 저장해 달라고 한다")
    raise Unsupported(f"{path.name}: 모르는 형식 ({ext or '확장자 없음'}) — PDF 나 텍스트로 달라고 한다")


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        # 한글 Windows 의 cp949 출력은 일부 글자에서 죽는다
        stream.reconfigure(encoding="utf-8", errors="replace")
    if len(sys.argv) < 2:
        sys.exit("사용법: extract_text.py <파일> [파일 …]")

    failed = 0
    for arg in sys.argv[1:]:
        path = Path(arg)
        print(f"===== {path.name} =====")
        try:
            print(extract(path))
        except Unsupported as e:
            failed += 1
            print(f"(못 읽음) {e}")
        except OSError as e:
            failed += 1
            print(f"(못 읽음) {path.name}: {e}")
        print()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
