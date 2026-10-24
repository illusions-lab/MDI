---
title: note export
description: What `--to note` can preserve, what note only accepts through its editor UI, and how to verify a paste.
---

`mdi build manuscript.mdi --to note` writes `manuscript_note.txt` in UTF-8.
The result is a **note-editor input profile**, not a standard Markdown document
and not a `.note` file. `--to txt-all` includes this sixth text flavor.

The distinction matters: note documents its Markdown spellings as editor
shortcuts. Some require a trailing space or Return key, while uploads and
toolbar-only properties cannot be encoded in a plain-text file. Ruby is
different: note applies `｜base《reading》` when the draft is saved or
published, and accepts either a fullwidth or ASCII vertical bar.

The note Import screen accepts WXR (WordPress XML) and MT text, not this file.
Pasting a whole document is not a documented Markdown-import operation:
retype the trigger and its following space/Return when the editor does not
activate a shortcut.

## Text representation

| MDI / Markdown input | note output | Contract |
| --- | --- | --- |
| Heading depth 1 | `## heading` | note's large heading |
| Heading depth 2–6 | `### heading` | note has only large and small headings |
| Strong / GFM deletion | `**strong** ` / `~~deleted~~ ` | the trailing half-width space is note's documented activation keystroke |
| Ordered or unordered list | `1. item` / `- item` | readable indentation is retained; create real nesting with Tab/Shift+Tab in note |
| Block quote | `> quote` | quote source has no plain-text notation |
| Code block | fenced code with its source label | only an exact triple-backtick `mermaid` fence has a documented diagram contract |
| Thematic break | `---` | note divider shortcut |
| MDI ruby | `｜base《reading》` | note's native ruby notation |
| note TeX already present in body text | `$${...}$$` or a `$$` block | preserved; inline TeX is flattened in headings and quotes, where note disallows it |
| Bare URL | bare URL | readable source; create an embed by pasting it alone into an empty paragraph, with Enter when required |
| Link or image | `label (URL)` / `Image: alt (URL)` | readable fallback; note does not document Markdown link/image import |
| Footnote | numbered reference plus end notes | readable fallback; note has no footnote block |
| Table | tab-separated text | readable fallback; note has no table block |

Tate-chu-yoko, boten, warichu, kerning, no-break, page breaks, task-list
checkboxes, italic emphasis, inline code, and raw HTML have no documented note
equivalent. Their readable content is retained, while unsupported styling is
dropped. An MDI page break becomes a visual `---` divider and therefore loses
pagination semantics.

note documents no backslash escape for shortcut or ruby delimiters. Literal
text is therefore preserved without invented escapes; a literal sequence that
looks like note markup has no lossless representation in this text profile.

## Capability and platform-property matrix

| note capability | Text export status |
| --- | --- |
| Paragraphs, line breaks, two heading levels, bold, strike, lists, quote, code, divider | Shortcut input sequences are emitted; bulk-paste activation is not guaranteed |
| Nested lists | Visual indentation is retained; use Tab/Shift+Tab or note's hierarchy shortcuts, up to five levels |
| Ruby | Native notation is preserved; bold/link selection must cover the complete `｜base《reading》` sequence |
| Inline/display TeX | Native notation is preserved in supported body contexts; inline TeX is unavailable in headings, code blocks, and quotes, and note documents additional KaTeX/iOS limits |
| Mermaid code | Exact triple-backtick `mermaid` blocks are retained; a fence collision degrades to readable code |
| Text links | Label and URL are preserved; applying a link to selected text is editor-only |
| Center/right alignment | Content retained; alignment is toolbar-only |
| Quote source and source URL | Quote retained; the dedicated source field is editor-only |
| Table of contents | Headings retained; inserting/enabling the TOC is editor-only |
| Body image, alt text, description, size, and image link | Alt text and URL retained; upload and image properties are editor-only |
| Cover image and title field | Front matter remains outside the body text; set these in the publishing UI |
| File, native audio, and comic upload | Cannot be represented by a text export |
| External video, music, audio, SNS, article, design, business, form, map, shopping, event, development, comic/game, crowdfunding, recruiting, news, recipe, and other embeds | A bare URL is preserved; embed creation depends on a separate empty-paragraph paste/Enter, provider permission, and `notebot` access |
| Japanese/US stock chart shortcuts and note Money URLs | Literal source is preserved; notation is Web-only, requires Return, fixes the chart at six months, and excludes ETF/REIT/funds/indexes |
| Hashtags, price, paid-preview line, publication state, comments/likes, and other note properties | Not body text; configure in note's publishing UI |
| note Import/Export | `--to note` is not WXR or MT and cannot be submitted to Import; note's own export is a WXR ZIP with separate assets |

The external-provider list changes independently of MDI; use note's live
provider page instead of treating a hard-coded list as a file-format grammar.

## Verification

Open a new note article and paste the UTF-8 output into the body. This preserves
the text but does not prove shortcut activation. Where a block remains literal,
remove and retype its marker plus the documented space/Return. Build nested
lists with Tab/Shift+Tab. Paste embed URLs separately into empty paragraphs and
press Enter when required. Save the draft to activate and verify ruby. Complete
uploads, alignment, image descriptions, quote sources, TOC, and publishing
metadata in the UI.

Authoritative references:

- [Editor capabilities](https://www.help-note.com/hc/ja/articles/360012426133-%E3%82%A8%E3%83%87%E3%82%A3%E3%82%BF-%E8%A8%98%E4%BA%8B%E7%B7%A8%E9%9B%86%E7%94%BB%E9%9D%A2-%E3%81%A7%E3%81%A7%E3%81%8D%E3%82%8B%E3%81%93%E3%81%A8)
- [Markdown shortcuts](https://www.help-note.com/hc/ja/articles/4410617032217-Markdown%E3%82%B7%E3%83%A7%E3%83%BC%E3%83%88%E3%82%AB%E3%83%83%E3%83%88)
- [List hierarchy](https://www.help-note.com/hc/ja/articles/4410433722777-%E7%AE%87%E6%9D%A1%E6%9B%B8%E3%81%8D-%E7%95%AA%E5%8F%B7%E4%BB%98%E3%81%8D%E3%83%AA%E3%82%B9%E3%83%88%E3%81%AB%E3%81%99%E3%82%8B)
- [Ruby notation](https://www.help-note.com/hc/ja/articles/4406430353817-%E3%83%AB%E3%83%93-%E3%81%B5%E3%82%8A%E3%81%8C%E3%81%AA-%E3%82%92%E3%81%B5%E3%82%8B)
- [TeX notation](https://www.help-note.com/hc/ja/articles/4410665086873-%E6%95%B0%E5%BC%8F%E8%A8%98%E6%B3%95%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9)
- [Mermaid diagrams](https://www.help-note.com/hc/ja/articles/25858251439513-Mermaid%E3%82%92%E4%BD%BF%E3%81%A3%E3%81%A6%E3%83%80%E3%82%A4%E3%82%A2%E3%82%B0%E3%83%A9%E3%83%A0%E3%82%92%E4%BD%9C%E6%88%90%E3%81%99%E3%82%8B)
- [Supported embed services](https://www.help-note.com/hc/ja/articles/360019596133-%E3%83%86%E3%82%AD%E3%82%B9%E3%83%88%E8%A8%98%E4%BA%8B%E3%81%AB%E5%9F%8B%E3%82%81%E8%BE%BC%E3%81%BF%E3%81%A7%E3%81%8D%E3%82%8B%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9%E4%B8%80%E8%A6%A7)
- [Import specification](https://www.help-note.com/hc/ja/articles/16143759138329-%E3%82%A4%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%88%E6%A9%9F%E8%83%BD%E3%81%AE%E4%BB%95%E6%A7%98)
- [Export specification](https://www.help-note.com/hc/ja/articles/16143457500953-%E3%82%A8%E3%82%AF%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%88%E6%A9%9F%E8%83%BD%E3%81%AE%E4%BB%95%E6%A7%98)
- [Stock charts](https://www.help-note.com/hc/ja/articles/43881079418137-%E8%A8%98%E4%BA%8B%E3%81%AB%E6%A0%AA%E4%BE%A1%E3%83%81%E3%83%A3%E3%83%BC%E3%83%88%E3%82%92%E5%9F%8B%E3%82%81%E8%BE%BC%E3%82%81%E3%82%8B%E6%A9%9F%E8%83%BD%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6)
