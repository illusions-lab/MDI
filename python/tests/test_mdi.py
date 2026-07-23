from __future__ import annotations

import json
from io import BytesIO
from typing import Any
from zipfile import ZipFile

import pytest

import mdi


SOURCE = """---
title: 東京の夜
lang: ja
author: MDI
---

# {東京|とうきょう}の夜

本文[^n] ^12^

[^n]: 注の本文
"""


def assert_valid_spans(node: dict[str, Any], source: str) -> None:
    span = node.get("span")
    if span is not None:
        assert 0 <= span["startByte"] <= span["endByte"] <= len(source.encode("utf-8"))
    for child in node.get("children", []):
        assert_valid_spans(child, source)


def test_exposes_the_complete_versioned_rust_document_contract() -> None:
    result = mdi.parse(SOURCE)

    assert result["irVersion"] == mdi.MDI_IR_VERSION == "1.0"
    assert result["syntaxVersion"] == mdi.MDI_SPEC_VERSION == "2.0"
    assert result["capabilities"] == {
        "mdi": True,
        "commonMark": True,
        "gfm": True,
        "frontMatter": True,
        "sourceSpans": True,
    }
    assert result["diagnostics"] == []
    assert result["document"]["frontmatter"]["entries"] == [
        {"key": "title", "value": "東京の夜"},
        {"key": "lang", "value": "ja"},
        {"key": "author", "value": "MDI"},
    ]
    assert [node["type"] for node in result["document"]["children"]] == [
        "heading",
        "paragraph",
        "footnoteDefinition",
    ]
    assert result["document"]["span"] == {"startByte": 0, "endByte": len(SOURCE.encode())}
    assert_valid_spans(result["document"], SOURCE)


def test_rust_owns_nested_syntax_decisions_and_literal_fallbacks() -> None:
    result = mdi.parse("**第^12^話**\n\n| a | b |\n| - | - |\n| 1 | 2 |")
    assert [node["type"] for node in result["document"]["children"]] == ["paragraph", "table"]

    literal = mdi.parse("`^12^`\n\n[[kern:wide:text]]")
    code = literal["document"]["children"][0]["children"][0]
    assert code == {"type": "inlineCode", "value": "^12^", "span": {"startByte": 0, "endByte": 6}}
    assert literal["document"]["children"][1]["type"] == "paragraph"


def test_returns_recoverable_diagnostics_with_utf8_byte_spans() -> None:
    source = "---\nmdi: '3.0'\n---\n\n👨‍👩‍👧"
    result = mdi.parse(source)

    assert result["diagnostics"] == [{
        "severity": "warning",
        "code": "mdi.version.unsupported",
        "message": "MDI 3.0 is newer than the supported 2.0",
        "span": {"startByte": 0, "endByte": 18},
    }]
    assert result["document"]["span"]["endByte"] == len(source.encode())


def test_serializes_and_renders_complete_source_in_rust() -> None:
    source = "# 題\n\n{東京|とうきょう} ^12^"
    assert "<h1>題</h1>" in mdi.render_html(source)
    assert '<ruby class="mdi-ruby">東京' in mdi.render_html(source)
    assert mdi.serialize_mdi("{東京|とう.きょう} ^12^") == "{東京|とう.きょう} ^12^\n"
    assert mdi.render_text("{東京|とうきょう} ^12^") == "東京 12\n"


@pytest.mark.parametrize(
    ("format", "expected"),
    [
        ("txt", "　東京"),
        ("txt-ruby", "　{東京|とうきょう}"),
        ("narou", "　｜東京《とうきょう》"),
        ("kakuyomu", "　｜東京《とうきょう》"),
        ("aozora", "　｜東京《とうきょう》"),
        ("note", "　｜東京《とうきょう》"),
    ],
)
def test_renders_every_public_text_format(format: mdi.TextFormat, expected: str) -> None:
    assert mdi.render_text_format("{東京|とうきょう}", format, "　") == expected


def test_packaged_archives_are_created_in_rust_with_required_parts() -> None:
    epub = mdi.render_epub(SOURCE)
    docx = mdi.render_docx(SOURCE)

    assert epub.startswith(b"PK")
    assert docx.startswith(b"PK")

    with ZipFile(BytesIO(epub)) as archive:
        assert archive.read("mimetype") == b"application/epub+zip"
        assert "OEBPS/package.opf" in archive.namelist()
        assert "東京の夜" in archive.read("OEBPS/package.opf").decode()

    with ZipFile(BytesIO(docx)) as archive:
        assert "[Content_Types].xml" in archive.namelist()
        assert "word/document.xml" in archive.namelist()
        assert "東京" in archive.read("word/document.xml").decode()


def test_public_api_exports_and_legacy_alias() -> None:
    assert set(mdi.__all__) == {
        "MDI_IR_VERSION",
        "MDI_SPEC_VERSION",
        "MdiRenderError",
        "TextFormat",
        "parse",
        "parse_mdi_syntax",
        "render_docx",
        "render_epub",
        "render_html",
        "render_text",
        "render_text_format",
        "serialize_mdi",
    }
    assert mdi.parse_mdi_syntax is mdi.parse
    assert issubclass(mdi.MdiRenderError, Exception)


@pytest.mark.parametrize(
    "call",
    [
        lambda: mdi.parse(None),  # type: ignore[arg-type]
        lambda: mdi.render_html(None),  # type: ignore[arg-type]
        lambda: mdi.serialize_mdi(None),  # type: ignore[arg-type]
        lambda: mdi.render_text(None),  # type: ignore[arg-type]
        lambda: mdi.render_epub(None),  # type: ignore[arg-type]
        lambda: mdi.render_docx(None),  # type: ignore[arg-type]
        lambda: mdi.render_text_format("text", "txt", None),  # type: ignore[arg-type]
    ],
)
def test_host_boundary_rejects_non_string_inputs(call: Any) -> None:
    with pytest.raises(TypeError):
        call()


def test_text_format_validation_and_unsupported_ir_guard(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValueError, match="Unsupported text format"):
        mdi.render_text_format("text", "invalid")  # type: ignore[arg-type]

    monkeypatch.setattr(mdi._native, "parse_json", lambda _source: json.dumps({"irVersion": "999.0"}))
    with pytest.raises(RuntimeError, match="Unsupported MDI IR version: 999.0"):
        mdi.parse("text")
