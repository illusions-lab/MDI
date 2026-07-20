---
title: Export profiles
description: CLI `--config` 的 JSON export profile，以及每個 output format 今天實際消費的欄位。
---

**先備知識：**[CLI](/zh-tw/bindings/cli/)、[轉譯模型](/zh-tw/core/rendering/)。

export profile 是交給 `mdi build --config profile.json` 的 JSON 設定。它讓出版 workflow 將 page size、margin、font、text indentation 等 output policy 與 `.mdi` source 分離；它不是 syntax，也不改變 Document IR。

## 基本使用

```bash
mdi build novel.mdi --to pdf --config novel.export.json -o dist/novel.pdf
```

profile schema 與所有欄位的正式定義請以 `@illusions-lab/mdi-export-profile` package 為準。最重要的目前行為是下表，而不是假設每個 renderer 都支援每個 profile option。

## 目前支援矩陣

| Output | Profile 狀態 |
| --- | --- |
| PDF | **已套用。**page geometry 與 font 等 print/layout settings 傳到 Chromium PDF workflow。 |
| TXT（五種） | **已套用。**profile 可提供傳給 `render_text_format` 的 indentation policy。 |
| HTML | 不以 profile 改寫 standalone `render_html` output。 |
| EPUB | **尚待完成。**目前只讀 front matter 的 title/author/lang/writing-mode。 |
| DOCX | **尚待完成。**目前只讀同一組 front matter metadata，並為 baseline plain-text typography。 |

對 EPUB/DOCX 傳 `--config` 不報錯，但 profile 不會被套用。cover images、configurable chapter split、page geometry、font selection 都是 [Rust Core API 尚未實作](/zh-tw/core/rust-api/#not-yet-implemented) 的後續 API，而非已存在但被文件忽略的功能。

## Front matter 與 profile 的職責

front matter 描述文件本身：`title`、`author`、`lang`、`identifier`、`writing-mode`。profile 描述某次輸出的呈現政策。即使 profile 不支援，EPUB/DOCX 仍會從 front matter 填 metadata，並在 vertical writing 時採用相應的 EPUB direction/CSS。

## 下一步

- [CLI](/zh-tw/bindings/cli/)
- [轉譯模型](/zh-tw/core/rendering/)
- [輸出格式](/zh-tw/ecosystem/outputs/)
