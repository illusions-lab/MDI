---
title: Migration 與 compatibility
description: 目前實作和 SYNTAX.md 所有已知差異，以及如何遷移 deprecated API。
---

MDI 2.0 syntax 只在 [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) 定義。實作尚未完整符合 spec 的地方都集中寫在這裡，避免意外發現；MDI 的原則是不默默選邊，永遠說明何者 normative、何者是目前行為。

## Stylesheet parity

`SYNTAX.md` 為每個 MDI construct 規定精確 CSS。`@illusions-lab/mdi-to-hast` stylesheet（本文件站與 `to-hast`/`to-html` adapter path 所用）精確吻合。`mdi-core` 的 embedded stylesheet（`render_html`、CLI `--to html`、直接 `renderHtml()` 實際輸出的 CSS）目前有三項差異：

| Selector | `SYNTAX.md` / `mdi-to-hast` | `mdi-core` `render_html` | 實際影響 |
| --- | --- | --- |
| `.mdi-em` | `text-emphasis: var(--mdi-em, "﹅")`、`-webkit-text-emphasis`、`text-emphasis-position: over right`、`.mdi-em rt { text-emphasis: none; }` | `text-emphasis: var(--mdi-em, filled sesame)`；沒有 position、`rt` suppression、`-webkit-` prefix | custom mark 仍會 render，但位置依 browser default；包 ruby 的 boten 可能也標在 `<rt>` reading。 |
| `.mdi-warichu` | `display: inline-block; font-size: 0.5em; line-height: 1.1; max-inline-size: 10em; vertical-align: middle; text-align: start;` | 僅 `font-size: .6em` | note 會變小 inline，但沒有 spec CSS 的 two-line wrap approximation。 |
| `.mdi-blank` | `min-block-size: 1lh` | `min-height: 1em` | horizontal 相同；vertical 時 `min-height` 不是 blank paragraph 應保留的 inline space。 |

HTML element structure/class name 完全相同，差異純為 CSS。若今天需要完全 spec-parity style，使用 `mdi-to-hast` stylesheet；是否已修正，請以 [`mdi-core/src/lib.rs`](https://github.com/illusions-lab/MDI/blob/main/mdi-core/src/lib.rs) 的 `MDI_STYLESHEET` 為準。

## Deprecated APIs 與替代品

| Deprecated | 改用 | 原因 |
| --- | --- | --- |
| `parseMdiSyntax`（JavaScript） | `parse` | 今日相同 function（direct alias）；舊名只為舊 caller 遷移。 |
| `parse_mdi_syntax`（Rust） | `parse_document` / `parse_output` | 回傳舊 `MdiSyntaxDocument`，沒有 spans、front matter、一般 Markdown nodes；詳見 [Document IR](/zh-tw/core/document-ir/#the-transitional-mdisyntaxdocument-shape)。 |

## IR version handling

將 `irVersion` 視為 wire-protocol version，不是 cosmetic string；不認識的版本應拒絕，不可猜測 shape。`@illusions-lab/mdi` 的 `parse()` 已這樣做。

## Byte spans，不是 character indexes

IR 所有 span 都是 UTF-8 byte offset。不要未經明確轉換就視為宿主語言 character index；請見[診斷](/zh-tw/core/diagnostics/#spans-precisely)與[Python](/zh-tw/bindings/python/#ir-version-and-utf-8-byte-spans)。

## Remark adapter：今日僅單向

`@illusions-lab/mdi-remark` 將真實 Rust output 轉成 `mdast`，但編輯後的 `mdast` tree round-trip 回 `.mdi` 尚未套用 Rust 的 recommended-form normalization（例如 `《《...》》` → `[[em:...]]`）。詳見 [Remark adapter](/zh-tw/ecosystem/remark/#current-implementation-status-one-way-today)。

## Documentation build note

本文件站的 Markdown/MDI example 經由 `@illusions-lab/mdi-remark`（`astro.config.mjs`），即上方 Rust-backed adapter，不是 documentation-only parser。若本站與 CLI/JavaScript package 的同一 source render 不同，這是應回報的 bug。

## 下一步

- [Rust Core API](/zh-tw/core/rust-api/#not-yet-implemented)
- [完整 syntax reference](/zh-tw/syntax/reference/)
