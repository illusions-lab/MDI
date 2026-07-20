---
title: CLI
description: @illusions-lab/mdi-cli の install、format、flag、実際の挙動。
---

**前提:** [Getting Started](/ja/guides/getting-started/)。

`.mdi` を code なしに HTML、PDF、EPUB、DOCX、TXT に変換するには `mdi build` を使います。CLI は同じ Rust function を呼び、extension 選択と file write 以外に renderer を持ちません。

## Install

```bash
npm install --global @illusions-lab/mdi-cli
```

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

| Flag | 必須 | 意味 |
| --- | --- | --- |
| `<input.mdi>` | Yes | UTF-8 source path |
| `--to` | Yes | 下記の format |
| `-o` | No | 出力 path。`txt-all` とは併用不可 |
| `--config` | No | [export profile](/ja/ecosystem/export-profiles/) JSON |

```bash
echo '{東京|とうきょう}は雨だった。' > novel.mdi
mdi build novel.mdi --to html
```

| `--to` | default path | Rust renderer |
| --- | --- | --- |
| `html` / `pdf` / `epub` / `docx` | `.html` / `.pdf` / `.epub` / `.docx` | HTML / HTML + Chromium / EPUB / DOCX |
| `txt` | `.txt` | ruby を捨てる text |
| `txt-ruby` | `_ruby.txt` | ruby を維持 |
| `narou` / `kakuyomu` / `aozora` | respective suffix | 投稿規約 text。aozora は Shift_JIS |
| `txt-all` | 6 text file | `-o` は reject |

PDF 以外は Rust core が直接 render します。PDF は Rust HTML を local Chromium が layout します。Chromium は `.mdi` を見ません。`--config` は現在 PDF geometry/font と text indentation に効き、EPUB/DOCX は front matter metadata のみを読みます。

failure は stderr 一行と exit `1`、success は `Written <path>` と exit `0` です。全 format は実装済みです。EPUB/DOCX の profile 対応、watch/server/editor、glob/batch input は未対応です。

## 次へ

- [Export profile](/ja/ecosystem/export-profiles/)
- [レンダリングモデル](/ja/core/rendering/)
