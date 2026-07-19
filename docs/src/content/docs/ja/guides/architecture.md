---
title: アーキテクチャ
description: mdi-js の 9 パッケージの関係と、パイプラインをこの位置で分割している理由。
---

## パッケージのレイヤー

| パッケージ | レイヤー | 役割 |
|---------|-------|------|
| `micromark-extension-mdi` | パーサコア | CommonMark の上で MDI のインライン/ブロック構文をトークナイズ。 |
| `mdast-util-mdi` | パーサコア | トークンイベントを mdast ノードへコンパイルし、markdown へ書き戻す。 |
| `@illusions-lab/mdi-remark` | パーサコア | GFM + YAML フロントマター + MDI 拡張をまとめた単一 remark プラグイン。推奨エントリポイント。 |
| `@illusions-lab/mdi-to-hast` | 共有変換 | 仕様の HTML マッピングに従い MDI mdast ノードを hast へ変換。ハンドラ表（`mdiHandlers`）とスタイルシートをエクスポート。 |
| `@illusions-lab/mdi-to-html` | コンバータ | hast → スタイルシート込みの完全な HTML ドキュメント文字列。 |
| `@illusions-lab/mdi-to-pdf` | コンバータ | HTML をヘッドレス Chromium で描画し PDF として出力。 |
| `@illusions-lab/mdi-to-epub` | コンバータ | hast → EPUB 3（XHTML・OPF マニフェスト・nav。改ページで spine を分割）。 |
| `@illusions-lab/mdi-to-docx` | コンバータ | mdast → ネイティブ OOXML。hast を完全にバイパス。 |
| `@illusions-lab/mdi-cli` | CLI | `mdi build input.mdi --to html\|pdf\|epub\|docx` — コンバータの薄いラッパー。 |

## パイプライン

```
micromark-extension-mdi ─▶ mdast-util-mdi ─▶ @illusions-lab/mdi-remark
                                  │
                                  ▼  (単一の mdast ツリー)
                        @illusions-lab/mdi-to-hast ────────┐
                            │              │               │
                            ▼              ▼               │
                       mdi-to-html    mdi-to-epub          │
                            │                              │
                            ▼                              ▼
                       mdi-to-pdf                    mdi-to-docx
                                              (mdast を直接読む)
```

すべてのコンバータは `@illusions-lab/mdi-remark` が生成する**同一の
mdast ツリー**を消費するため、エディタ側とエクスポート側の挙動が
分岐しません（仕様の
[パース順序](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md#parsing-order--パース順序)
を参照）。

## なぜこの位置で分割するのか

**4 フォーマット中 3 つは HTML 系です。** HTML・PDF（ブラウザから印刷）・
EPUB（XHTML の zip）は同じ mdast → hast マッピングを必要とするため、
そのマッピングを `@illusions-lab/mdi-to-hast` に一度だけ実装し、3 つの
コンバータは薄く保っています。

**PDF は意図的に本物のブラウザを通します。** 日本語組版の機能 —
`writing-mode: vertical-rl`、`text-combine-upright`（縦中横）、
`text-emphasis`（傍点）— は、軽量な HTML→PDF ライブラリがまさに
間違える CSS です。ヘッドレス Chromium は正しく描画するため、
`mdi-to-pdf` はあえて「HTML を開いて印刷するだけ」です。

**DOCX は HTML 系ではありません。** Word には同じ概念のネイティブ構造
（`<w:ruby>`、`<w:eastAsianLayout w:combine="1"/>`、セクション単位の
縦書き）があり、hast からのマッピングでは一度持っていた意味論を HTML
から掘り起こし直すことになります。そのため `mdi-to-docx` は mdast
ツリーを直接読みます。

**パーサコアが 1 つでなく 3 パッケージなのは**、micromark/mdast
エコシステムの慣例に従うためです: トークナイザと mdast ユーティリティは
単体で任意の unified パイプラインに組み込めます（このドキュメント
サイトはまさにその 2 つ + `mdiHandlers` だけを使い、コンバータを
使っていません）。一方 `@illusions-lab/mdi-remark` はアプリケーション
向けの全部入りプラグインです。

## Rust 構文コアと JavaScript-first リリース

MDI の正規の文法は、独立した
[`illusions-lab/MDI`](https://github.com/illusions-lab/MDI) 仕様リポジトリで
管理します。このリポジトリは既存の `mdi-js` 名と JavaScript の公開 API を
維持します。

`crates/mdi-core` は、エスケープ、書記素クラスタ対応のルビ、縦中横、傍点、
入れ子にできるインラインマクロ、ブロックマクロを扱う、言語非依存の Rust
実装です。CommonMark と GFM は意図的に解析せず、JavaScript アダプタ側の
micromark/remark に残します。これにより既存の mdast API と JS 利用者の挙動を
維持できます。

Rust コアを含む最初のリリースは JavaScript-first です。Cargo による検証を
既存の JavaScript テストと同時に実行しますが、公開 API は現在の
micromark/remark パイプラインのままです。Node、Python、WASM の native
binding は、別のパーサではなくこの同じコアに追加するアダプタです。

## バージョニング

パッケージのバージョンは `<MDI 仕様バージョン>.<リリース回数>` です —
major.minor は常に対応する MDI 仕様バージョン（現在 **2.0**）に一致し、
patch は各パッケージ独自のリリースカウンタで `.1` から始まります。
つまり `2.0.5` は「MDI 2.0 対応の 5 回目のリリース」を意味し、patch
はパッケージ間で同期しません。
