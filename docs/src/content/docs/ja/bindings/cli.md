---
title: CLI
description: "@illusions-lab/mdi-cli の install、format、flag、実際の挙動。"
---

**前提:** [Getting Started](/ja/guides/getting-started/)。

`.mdi` を code なしに HTML、PDF、EPUB、DOCX、TXT に変換するには `mdi build` を使います。CLI は同じ Rust function を呼び、extension 選択と file write 以外に renderer を持ちません。

## この binding で解決すること

一つの `.mdi` file から code を書かずに全出力を作る command-line entry point です。binary は `mdi`、subcommand は現在 `build` 一つだけです。引数なしや認識されない `--to` は usage を出して status `1` で終了します。

## Install

```bash
npm install --global @illusions-lab/mdi-cli
```

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

## command と flag

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

## Text format と export profile

各 text flavor は単独で、または `txt-all`（`-o` は不可）でまとめて出力できます。`txt-all` は通常 text、ruby、narou、kakuyomu、aozora の各 file を input の隣に書きます。構文ごとの対応は [構文リファレンス](/ja/syntax/reference/) を参照してください。

`--config` は現在 PDF の geometry/font と text の indentation に効きます。EPUB/DOCX は意図的に front matter metadata のみを使い、profile をまだ消費しません。未対応 format へ `--config` を渡しても error にはなりません。

## Error と exit code

失敗時は stack trace ではなく stderr に一行を出し status `1` で終了します。存在しない input は OS の `ENOENT` message、未知 format や不足 flag は usage、`txt-all -o` は `--to txt-all does not accept -o` を出します。成功時は `Written <path>` と status `0` です。

## 現在の実装状況と非対応

表の全 format は実装済みで、別 JavaScript renderer や `remark`/`micromark` parse pass は通りません。EPUB/DOCX の profile 対応、watch/server/editor、glob/batch input は未対応です。PDF は実行マシンに Chromium-family browser が必要です。

## 次へ

- [Export profile](/ja/ecosystem/export-profiles/)
- [レンダリングモデル](/ja/core/rendering/)
