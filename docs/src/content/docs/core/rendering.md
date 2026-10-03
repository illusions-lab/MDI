---
title: Rendering model and the Chromium/PDF boundary
description: How Rust turns one MDI document into baseline and configured exports, and where a PDF host takes over.
---

**Prerequisites:** [Document IR](/core/document-ir/) and [Export profiles](/ecosystem/export-profiles/).

## One semantic source, one publication contract

Rust owns the `.mdi` parse, diagnostic codes and UTF-8 spans, semantic output, and publication-profile resolution. Ruby, tate-chu-yoko, no-break, kerning, blank paragraphs, page breaks, paper dimensions, and EPUB/DOCX layout are therefore decided in one place.

The profile remains separate from document meaning: changing a font or page size never changes how MDI is parsed. Rust validates that profile and applies metadata, chapters, typography, page setup, and numbering. A PDF host is responsible only for locating or launching Chromium and returning its bytes; application UI preferences remain with the application.

Configured publication exports require one explicit `layout.system`. `japanese-publisher` is the strict Japanese book contract: horizontal pages use `Shirokuban`, 10 pt Mincho, mirrored spreads, left binding, and 27×26; vertical pages use the A4-landscape novel manuscript, mirrored spreads, right binding, and 40×30. `word` is intentionally incompatible: A4, 25.4 mm on all four sides, no mirroring, and flowing `typographic` layout; it rejects `strict`.

| Output | Baseline API | Configured route |
| --- | --- | --- |
| HTML | `renderHtml(source)` | `{ bodyOnly: true }`, or `renderHtmlWithDiagnostics` for output + headings/spans. |
| TXT | `renderTextFormat(source, format, indentPrefix)` | caller supplies text indentation. |
| EPUB | `renderEpub(source)` | `await renderEpub(source, { profile, cover })` or aliases such as `title`, `chapterSplitLevel`, and `coverImage`. |
| DOCX | `renderDocx(source)` | `await renderDocx(source, profile)` with metadata, page, type, and page-number values. |
| PDF | — | `@illusions-lab/mdi/node` hands Rust-prepared HTML, page geometry, and page-number templates to a Chromium-capable host. |

## Diagnostics, headings, and semantic HTML

Call `parse(source)` or `prepareRender(source)` before offering export when the UI must display warnings. Its `document` preserves spans and `diagnostics`; source errors do not become exceptions merely because an export can fall back to literal text. `renderHtmlWithDiagnostics(source, options)` retains the same information with the HTML plus source-order headings. The renderer cannot yet take a serialized IR handle, so this helper validates and renders from the same source in sequence rather than inventing a second parser.

HTML is semantic and stable: `renderHtml` returns a complete page including MDI CSS, while `bodyOnly` returns only `<body>` contents for an app shell. Ruby uses `<ruby>`, `<rt>`, and `<rp>`; MDI extensions have predictable `mdi-*` classes for host styling.

## EPUB and DOCX

The single-argument calls are synchronous Rust baseline exports: useful when front matter is enough and no publication profile is required. The configured JavaScript calls retain their asynchronous shape for compatibility, but profile validation and EPUB/DOCX archive generation now run in Rust. JavaScript does not keep a parallel page-size table or document generator.

Configured EPUB accepts title/author/publisher/language/date/identifier, vertical writing, font family, text indent, `h1`/`h2`/`h3`/`none` chapter splitting, and a JPEG/PNG cover. Configured DOCX accepts metadata; page size, orientation and four margins; writing direction, font family, font size, line spacing and indent; and page-number visibility, position and `simple`/`dash`/`fraction` format.

DOCX maps page breaks, writing direction, ordinary paragraphs, and available inline/run formatting to OOXML. Its ruby, tate-chu-yoko, kinsoku/no-break, kerning, and forced-blank behavior is necessarily an OOXML approximation, not a claim of browser-identical typography. Verify a target reader when those features determine layout.

## The Chromium/PDF boundary

`preparePdfExport(source, profile)` in `@illusions-lab/mdi/node` returns Rust-prepared HTML and resolved print data. Electron can print that request through its own BrowserWindow. `renderPdfWithChromium(source, profile)` instead loads the optional, separately installable `@illusions-lab/mdi-to-pdf` Node host (Playwright) unless you pass an Electron-compatible `{ renderHtmlToPdf }` implementation.

Rust resolves and applies paper size, landscape, margins, vertical/horizontal flow, font family/size/line spacing, characters-per-line, lines-per-page, first-line indentation, and page-number templates. The host owns Chromium execution. Browser WASM cannot spawn Chromium, so browser code should prepare the request and send it to a Node, Electron, Tauri, or CLI host. Chromium receives completed HTML/CSS and print data, never `.mdi` source.

## What the contracts check

Unit and coverage tests run first. Once they pass, the publication suite opens
DOCX with the .NET Open XML SDK and LibreOffice, checks PDF structure and page
geometry, validates EPUB with W3C EPUBCheck, and verifies HTML. This catches
files that are valid ZIP archives but still fail in the applications readers
actually use.

## Next steps

- [JavaScript / TypeScript](/bindings/javascript/) for executable API examples.
- [CLI](/bindings/cli/) for profile-driven shell exports.
- [Diagnostics](/core/diagnostics/) for error codes and byte spans.
