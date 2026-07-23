"""Python bindings for illusion Markdown (MDI)."""

from __future__ import annotations

import json
from typing import Any, Final, Literal

from . import _native

MDI_SPEC_VERSION: Final = _native.MDI_SPEC_VERSION
"""MDI syntax version implemented by this binding."""

MDI_IR_VERSION: Final = _native.MDI_IR_VERSION
"""Version of the document-IR wire schema returned by :func:`parse`."""

TextFormat = Literal["txt", "txt-ruby", "narou", "kakuyomu", "aozora", "note"]
"""A Rust-supported plain-text export convention."""

MdiRenderError = _native.MdiRenderError
"""Raised when Rust cannot create an EPUB or DOCX archive."""


def parse(source: str) -> dict[str, Any]:
    """Parse complete MDI source into the versioned Rust-owned document IR.

    Source spans use half-open UTF-8 *byte* offsets. Recoverable syntax issues
    are returned in the ``diagnostics`` list.
    """
    result = json.loads(_native.parse_json(source))
    if result["irVersion"] != MDI_IR_VERSION:
        raise RuntimeError(f"Unsupported MDI IR version: {result['irVersion']}")
    return result


def render_html(source: str) -> str:
    """Render complete MDI source as a standalone HTML document in Rust."""
    return _native.render_html(source)


def serialize_mdi(source: str) -> str:
    """Normalize complete source to canonical MDI/Markdown in Rust."""
    return _native.serialize_mdi(source)


def render_text(source: str) -> str:
    """Render complete MDI source to deterministic plain text in Rust."""
    return _native.render_text(source)


def render_text_format(source: str, format: TextFormat, indent_prefix: str = "") -> str:
    """Render MDI using one of Rust's named publication-text conventions."""
    return _native.render_text_format(source, format, indent_prefix)


def render_epub(source: str) -> bytes:
    """Build a baseline EPUB 3 archive entirely in Rust."""
    return _native.render_epub(source)


def render_docx(source: str) -> bytes:
    """Build a baseline DOCX archive entirely in Rust."""
    return _native.render_docx(source)


parse_mdi_syntax = parse

__all__ = [
    "MDI_IR_VERSION", "MDI_SPEC_VERSION", "MdiRenderError", "TextFormat", "parse",
    "parse_mdi_syntax", "render_docx", "render_epub", "render_html", "render_text",
    "render_text_format", "serialize_mdi",
]
