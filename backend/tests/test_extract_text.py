"""scripts/extract_text — /start 가 고객 대화 · 계약서 파일을 읽을 때 쓴다.

실제 오피스 · 한글 파일과 같은 구조(압축 안의 XML)를 최소로 만들어 본다.
"""

import zipfile

import pytest

from scripts.extract_text import Unsupported, extract

W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
HP = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"'


def _zip(path, files: dict[str, str]):
    with zipfile.ZipFile(path, "w") as z:
        for name, body in files.items():
            z.writestr(name, body)
    return path


def test_docx_문단과_표_안의_글자(tmp_path):
    xml = (
        f"<w:document {W}><w:body>"
        "<w:p><w:r><w:t>제1조 (목적) </w:t></w:r><w:r><w:t>본 계약은</w:t></w:r></w:p>"
        "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>대금</w:t></w:r></w:p></w:tc>"
        "<w:tc><w:p><w:r><w:t>1,000만 원</w:t></w:r></w:p></w:tc></w:tr></w:tbl>"
        "</w:body></w:document>"
    )
    path = _zip(tmp_path / "계약서.docx", {"word/document.xml": xml})
    assert extract(path).splitlines() == ["제1조 (목적) 본 계약은", "대금", "1,000만 원"]


def test_hwpx_구역을_숫자_순서로(tmp_path):
    def section(text):
        return f"<hs:sec {HP} xmlns:hs='urn:s'><hp:p><hp:run><hp:t>{text}</hp:t></hp:run></hp:p></hs:sec>"

    path = _zip(
        tmp_path / "과업지시서.hwpx",
        {
            "Contents/section10.xml": section("열한째"),
            "Contents/section2.xml": section("셋째"),
            "Contents/section0.xml": section("첫째"),
        },
    )
    assert extract(path).splitlines() == ["첫째", "셋째", "열한째"]


def test_hwpx_줄바꿈_뒤_글자도_잇는다(tmp_path):
    xml = (
        f"<hs:sec {HP} xmlns:hs='urn:s'>"
        "<hp:p><hp:run><hp:t>납품<hp:lineBreak/>기한</hp:t></hp:run></hp:p></hs:sec>"
    )
    path = _zip(tmp_path / "a.hwpx", {"Contents/section0.xml": xml})
    assert extract(path) == "납품기한"


def test_xlsx_공유_문자열과_숫자(tmp_path):
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    path = _zip(
        tmp_path / "견적.xlsx",
        {
            "xl/sharedStrings.xml": (
                f"<sst {ns}><si><t>항목</t></si><si><t>금액</t></si><si><t>디자인</t></si></sst>"
            ),
            "xl/worksheets/sheet1.xml": (
                f"<worksheet {ns}><sheetData>"
                '<row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row>'
                '<row><c t="s"><v>2</v></c><c><v>3000000</v></c></row>'
                "</sheetData></worksheet>"
            ),
        },
    )
    assert extract(path) == "[시트 1]\n항목\t금액\n디자인\t3000000"


def test_cp949_로_저장한_메모도_읽는다(tmp_path):
    path = tmp_path / "메모.txt"
    path.write_bytes("고객: 다음 주까지 시안 주세요".encode("cp949"))
    assert extract(path) == "고객: 다음 주까지 시안 주세요"


@pytest.mark.parametrize(
    ("name", "hint"),
    [("계약서.hwp", "hwpx 나 PDF"), ("스캔.pdf", "Read"), ("옛날.doc", "docx")],
)
def test_못_읽는_형식은_어떻게_하면_되는지_알려준다(tmp_path, name, hint):
    path = tmp_path / name
    path.write_bytes(b"x")
    with pytest.raises(Unsupported, match=hint):
        extract(path)


def test_깨진_docx(tmp_path):
    path = tmp_path / "깨짐.docx"
    path.write_bytes(b"not a zip")
    with pytest.raises(Unsupported, match="깨졌거나"):
        extract(path)
