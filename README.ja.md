# MDI

[English](./README.md)

[![codecov](https://codecov.io/github/illusions-lab/MDI/graph/badge.svg?token=J6GJZW744R)](https://codecov.io/github/illusions-lab/MDI)

**illusion Markdown（MDI）** は、日本語組版のための Markdown 拡張フォーマットです。標準 Markdown を維持したまま、ルビ、縦中横、傍点、割注、縦書きなどを追加します。

このリポジトリは、[MDI 2.0 仕様](./SYNTAX.md)、Rust 実装、言語バインディング、レンダラー、開発ツールの正規リポジトリです。

ドキュメント：<https://mdi.illusions.app/>

## アーキテクチャ

Rust は MDI 構文と文書セマンティクスにおける唯一の実行可能な権威です。CommonMark、GFM、front matter、MDI 拡張をバージョン化された文書 IR に解析します。JavaScript、Python、Swift はこの実装の薄いホストインターフェースです。

`mdi-core` は、解析、検証、正規化、シリアライズ、決定論的な HTML、TXT、EPUB、DOCX レンダリングを担当します。PDF は Rust が生成した HTML を使い、ホスト側の Chromium adapter は印刷レイアウトだけを担当し、MDI を解析しません。

責務の規則とインターフェース契約は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

## リポジトリ構成

| ディレクトリ | 責務 |
| --- | --- |
| [`mdi-core/`](./mdi-core) | Rust パーサー、バージョン化 IR、検証、シリアライズ、決定論的レンダラー。 |
| [`nodejs/`](./nodejs) | JavaScript/WASM バインディング、生態系 adapter、CLI、ドキュメント。 |
| [`python/`](./python) | `mdi-core` の PyO3 バインディング。 |
| [`swift/`](./swift) | `mdi-core` の UniFFI または C ABI バインディング。 |

## Node.js パッケージ

| パッケージ | 用途 |
| --- | --- |
| [`@illusions-lab/mdi`](./nodejs/packages/mdi) | Rust を基盤とする主要な型付き JavaScript API。 |
| [`@illusions-lab/mdi-core`](./nodejs/packages/mdi-core) | 生成された低レベル WebAssembly bridge。 |
| [`@illusions-lab/mdi-cli`](./nodejs/packages/cli) | Rust を利用するコマンドライン adapter。 |
| [`@illusions-lab/mdi-to-pdf`](./nodejs/packages/to-pdf) | Rust HTML を Chromium でレイアウトする adapter。 |
| [`@illusions-lab/mdi-remark`](./nodejs/packages/remark)、[`mdast-util-mdi`](./nodejs/packages/mdast-util-mdi)、[`micromark-extension-mdi`](./nodejs/packages/micromark-extension-mdi) | Unified 生態系向け互換 adapter。 |
| [`@illusions-lab/mdi-to-hast`](./nodejs/packages/to-hast)、[`@illusions-lab/mdi-to-html`](./nodejs/packages/to-html)、[`@illusions-lab/mdi-to-epub`](./nodejs/packages/to-epub)、[`@illusions-lab/mdi-to-docx`](./nodejs/packages/to-docx) | 既存利用者向けに残す公開互換 adapter。 |
| [`@illusions-lab/mdi-export-profile`](./nodejs/packages/export-profile) | 共通の型付き出力 profile 設定。 |

## 開発

```bash
cd nodejs
pnpm install
pnpm build
pnpm test
```

```bash
cd mdi-core
cargo build
cargo test
```

WASM bridge のビルドには、`wasm32-unknown-unknown` Rust target と `wasm-pack` も必要です。Node workspace の build は自動的に実行します。CI は Rust core を Linux、macOS、Windows の x64 と ARM64 でテストし、Chromium PDF 出力を含む JavaScript 結合テストを Linux x64 で実行します。

## リリース

パッケージバージョンは `<MDI 仕様バージョン>.<パッケージのリリース番号>` です。MDI 2.0 では `2.0.1` から始まります。通常のリリースには patch Changeset を使います。`main` へのマージ後、GitHub Actions が npm Trusted Publishing（OIDC）でパッケージをビルド・公開します。

```bash
cd nodejs
pnpm changeset
pnpm version
```

MDI 仕様バージョンを上げるには、`nodejs/` から `pnpm bump-spec-version 2.1` を実行します。

## 関連プロジェクト

- [illusions-lab/milkdown-mdi](https://github.com/illusions-lab/milkdown-mdi) — MDI 構文と縦書き表示のための Milkdown エディタ plugin。

## ライセンス

プロジェクトのコードと MDI 仕様はすべて MIT ライセンスです。[LICENSE](./LICENSE) と [LICENSE-SPEC](./LICENSE-SPEC) を参照してください。
