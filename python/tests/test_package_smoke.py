"""Package-level smoke tests shared by pytest and distribution workflows.

The release jobs execute this file against an installed wheel or sdist.  Keep
it limited to the public ``mdi`` API and the Python standard library so that it
cannot accidentally pass by importing repository implementation details.
"""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
from importlib.metadata import version
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree
from zipfile import ZIP_STORED, ZipFile

import mdi


SOURCE = """---
title: 東京の夜
lang: ja
author: MDI
---

# {東京|とうきょう}の夜

本文 ^12^

[[pagebreak]]

## 第二章
"""


class _TagCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tags: list[str] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        del attrs
        self.tags.append(tag)


def _assert_xml_parts_parse(archive: ZipFile, suffixes: tuple[str, ...]) -> None:
    for name in archive.namelist():
        if name.endswith(suffixes):
            ElementTree.fromstring(archive.read(name))


def run_package_smoke(output_directory: Path, expected_version: str | None = None) -> None:
    """Exercise every format exposed by the installed Python distribution."""

    output_directory.mkdir(parents=True, exist_ok=True)
    if expected_version is not None:
        assert version("illusion-markdown") == expected_version

    html = mdi.render_html(SOURCE)
    assert html.startswith("<!DOCTYPE html>")
    assert '<html lang="ja">' in html
    assert "<title>東京の夜</title>" in html
    assert '<ruby class="mdi-ruby">' in html
    html_parser = _TagCollector()
    html_parser.feed(html)
    html_parser.close()
    assert {"html", "head", "body", "h1", "ruby", "rt"}.issubset(html_parser.tags)
    (output_directory / "smoke.html").write_text(html, encoding="utf-8")

    text = mdi.render_text(SOURCE)
    assert text == "東京の夜\n本文 12\n\n\f\n第二章\n"
    (output_directory / "smoke.txt").write_text(text, encoding="utf-8")

    text_formats = {
        "txt": "東京の夜\n\u3000本文 12\n\n第二章",
        "txt-ruby": "{東京|とうきょう}の夜\n\u3000本文 12\n\n第二章",
        "narou": "｜東京《とうきょう》の夜\n\u3000本文 12\n\n第二章",
        "kakuyomu": "｜東京《とうきょう》の夜\n\u3000本文 12\n\n第二章",
        "aozora": (
            "｜東京《とうきょう》の夜［＃「東京の夜」は大見出し］\r\n"
            "\u3000本文 12［＃「12」は縦中横］\r\n"
            "［＃改ページ］\r\n"
            "第二章［＃「第二章」は中見出し］"
        ),
        "note": (
            "## ｜東京《とうきょう》の夜\n\n"
            "\u3000本文 12\n\n"
            "---\n\n"
            "### 第二章"
        ),
    }
    for text_format, expected in text_formats.items():
        rendered = mdi.render_text_format(SOURCE, text_format, "\u3000")  # type: ignore[arg-type]
        assert rendered == expected
        (output_directory / f"smoke-{text_format}.txt").write_bytes(rendered.encode())

    canonical = mdi.serialize_mdi(SOURCE)
    assert mdi.serialize_mdi(canonical) == canonical
    parsed = mdi.parse(canonical)
    assert parsed["irVersion"] == mdi.MDI_IR_VERSION
    assert parsed["syntaxVersion"] == mdi.MDI_SPEC_VERSION
    assert [node["type"] for node in parsed["document"]["children"]] == [
        "heading",
        "paragraph",
        "pagebreak",
        "heading",
    ]
    (output_directory / "smoke.mdi").write_text(canonical, encoding="utf-8")

    epub_path = output_directory / "smoke.epub"
    epub_path.write_bytes(mdi.render_epub(SOURCE))
    with ZipFile(epub_path) as archive:
        names = set(archive.namelist())
        assert archive.infolist()[0].filename == "mimetype"
        assert archive.infolist()[0].compress_type == ZIP_STORED
        assert archive.read("mimetype") == b"application/epub+zip"
        assert {
            "META-INF/container.xml",
            "OEBPS/package.opf",
            "OEBPS/nav.xhtml",
            "OEBPS/chapter-1.xhtml",
            "OEBPS/chapter-2.xhtml",
        }.issubset(names)
        assert "東京の夜" in archive.read("OEBPS/package.opf").decode()
        assert "とうきょう" in archive.read("OEBPS/chapter-1.xhtml").decode()
        _assert_xml_parts_parse(archive, (".xml", ".opf", ".xhtml"))

    docx_path = output_directory / "smoke.docx"
    docx_path.write_bytes(mdi.render_docx(SOURCE))
    with ZipFile(docx_path) as archive:
        names = set(archive.namelist())
        assert {
            "[Content_Types].xml",
            "_rels/.rels",
            "docProps/core.xml",
            "word/document.xml",
            "word/styles.xml",
            "word/_rels/document.xml.rels",
        }.issubset(names)
        document_xml = archive.read("word/document.xml").decode()
        assert "東京" in document_xml
        assert "とうきょう" in document_xml
        assert 'w:type="page"' in document_xml
        _assert_xml_parts_parse(archive, (".xml", ".rels"))


def test_every_public_format_survives_package_level_smoke(tmp_path: Path) -> None:
    run_package_smoke(tmp_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--expected-version")
    args = parser.parse_args()

    if args.output_dir is not None:
        run_package_smoke(args.output_dir, args.expected_version)
        return

    with TemporaryDirectory(prefix="mdi-python-smoke-") as directory:
        run_package_smoke(Path(directory), args.expected_version)


if __name__ == "__main__":
    main()
