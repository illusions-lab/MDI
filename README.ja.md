[MDI 2.0 仕様](./SYNTAX.md) · [English README](./README.md)

# MDI

<p align="center">
  <strong>日本語組版のための Markdown ツール群</strong><br />
  ルビ、縦中横、傍点、割注、縦書きなどを扱えます。
</p>
<p align="center">
  <a href="https://mdi.illusions.app/ja/">
    <img src="https://img.shields.io/badge/Read%20the%20documentation-0B7285?style=for-the-badge&logo=readthedocs&logoColor=white" alt="MDI ドキュメントを読む" />
  </a>
</p>

## MDI とは？

**illusion Markdown（MDI）** は、日本語の出版・組版のための Markdown です。使い慣れた Markdown をそのまま保ちながら、ルビ、縦中横、傍点、割注、縦書き、ページを意識した出力といった日本語の文章表現に必要な機能を加えます。

`.mdi` 文書を一度書けば、HTML、PDF、EPUB、DOCX、そして note・カクヨム・小説家になろう・青空文庫向けのテキスト形式に出力できます。通常の CommonMark と GFM は有効な MDI でもあるため、必要な箇所だけで MDI の機能を使い始められます。

```mdi
# 春は曙

{東京|とうきょう}で第^12^話を読む。
```

## Rust で書かれた、ただ一つのパーサー

[`mdi-core`](./mdi-core) は、MDI 文法の正規 Rust 実装です。CommonMark、GFM、YAML front matter、MDI 拡張をバージョン化された文書 IR に解析し、決定論的な HTML、TXT、EPUB、DOCX、PDF レンダラーを提供します。

以下の各言語ツールキットは、文法を再実装せず、この同じパーサーを呼び出します。そのため、MDI 文書はどの環境でも一貫した構文、診断、レンダリングの意味論を持ちます。

## 言語ツールキット

| 言語 | ツールキット | ドキュメント |
| --- | --- | --- |
| Rust | [`mdi-core`](./mdi-core) | <a href="https://mdi.illusions.app/ja/bindings/rust/"><img src="https://img.shields.io/badge/Rust%20docs-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust ドキュメント" /></a> |
| JavaScript / TypeScript | [`nodejs/`](./nodejs) | <a href="https://mdi.illusions.app/ja/bindings/javascript/"><img src="https://img.shields.io/badge/JavaScript%20%2F%20TypeScript%20docs-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript / TypeScript ドキュメント" /></a> |
| Python | [`python/`](./python) | <a href="https://mdi.illusions.app/ja/bindings/python/"><img src="https://img.shields.io/badge/Python%20docs-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python ドキュメント" /></a> |
| Swift | [`swift/`](./swift) | <a href="https://mdi.illusions.app/ja/bindings/swift/"><img src="https://img.shields.io/badge/Swift%20docs-F05138?style=flat-square&logo=swift&logoColor=white" alt="Swift ドキュメント" /></a> |
| Android / Kotlin *（開発中）* | [`android/`](./android) | <a href="https://mdi.illusions.app/ja/bindings/android/"><img src="https://img.shields.io/badge/Android%20%2F%20Kotlin%20docs-3DDC84?style=flat-square&logo=android&logoColor=black" alt="Android / Kotlin ドキュメント" /></a> |

> **Android / Kotlin の状態:** バインディングは現在開発中で、Maven Central では安定版の公開パッケージとしてまだ配布していません。

## リポジトリ構成

| ディレクトリ | 役割 |
| --- | --- |
| [`mdi-core/`](./mdi-core) | Rust パーサー、バージョン化 IR、検証、シリアライズ、決定論的レンダラー。 |
| [`nodejs/`](./nodejs) | JavaScript/WASM バインディング、エコシステムアダプター、CLI、ドキュメント。 |
| [`python/`](./python) | `mdi-core` の PyO3 バインディング。 |
| [`swift/`](./swift) | `mdi-core` の UniFFI または C ABI バインディング。 |
| [`android/`](./android) | Android Kotlin/JNI バインディング、ネイティブビルドスクリプト、Android 契約。 |
| [`mdi-android-jni/`](./mdi-android-jni) | `mdi-core` 向けの Android 専用 JNI ファサード。 |

## Node.js パッケージ

| パッケージ | 用途 |
| --- | --- |
| [`@illusions-lab/mdi`](./nodejs/packages/mdi) | Rust を基盤とする主要な型付き JavaScript API。 |
| [`@illusions-lab/mdi-core`](./nodejs/packages/mdi-core) | 生成された低レベル WebAssembly ブリッジ。 |
| [`@illusions-lab/mdi-cli`](./nodejs/packages/cli) | Rust を利用するコマンドラインアダプター。 |
| [`@illusions-lab/mdi-to-pdf`](./nodejs/packages/to-pdf) | Rust HTML を Chromium でレイアウトするアダプター。 |
| [`@illusions-lab/mdi-remark`](./nodejs/packages/remark)、[`mdast-util-mdi`](./nodejs/packages/mdast-util-mdi) | Rust を利用する Unified エコシステム向けアダプター。 |
| [`@illusions-lab/mdi-to-hast`](./nodejs/packages/to-hast)、[`@illusions-lab/mdi-to-html`](./nodejs/packages/to-html)、[`@illusions-lab/mdi-to-epub`](./nodejs/packages/to-epub)、[`@illusions-lab/mdi-to-docx`](./nodejs/packages/to-docx) | 既存利用者向けに残す公開互換アダプター。 |
| [`@illusions-lab/mdi-export-profile`](./nodejs/packages/export-profile) | 共通の型付き出力プロファイル設定。 |

## プロジェクトの状態

[![CI](https://img.shields.io/github/actions/workflow/status/illusions-lab/MDI/ci.yml/CI?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI)](https://github.com/illusions-lab/MDI/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/github/actions/workflow/status/illusions-lab/MDI/docs.yml/Docs?branch=main&style=for-the-badge&logo=readthedocs&logoColor=white&label=Docs)](https://github.com/illusions-lab/MDI/actions/workflows/docs.yml)
[![npm version](https://img.shields.io/npm/v/%40illusions-lab%2Fmdi?style=for-the-badge&logo=npm&logoColor=white&label=npm)](https://www.npmjs.com/package/@illusions-lab/mdi)
[![License](https://img.shields.io/github/license/illusions-lab/MDI?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](./LICENSE)

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

WASM ブリッジのビルドには、`wasm32-unknown-unknown` Rust ターゲットと `wasm-pack` も必要です。Node ワークスペースのビルドが自動で実行します。CI は最初に Node.js、Rust（Linux・macOS・Windows の x64 / ARM64）、Swift、Python、Android の unit test と coverage を実行します。すべて通過してから、.NET Open XML SDK、LibreOffice、Chromium、W3C EPUBCheck、HTML contract で publication output を検証します。

## リリース

パッケージバージョンは `<MDI 仕様バージョン>.<パッケージのリリース番号>` です。MDI 2.0 では `2.0.1` から始まります。通常のリリースには patch Changeset を使います。`main` へのマージ後、GitHub Actions が npm Trusted Publishing（OIDC）でパッケージをビルド・公開します。

```bash
cd nodejs
pnpm changeset
pnpm version
```

MDI 仕様バージョンを上げるには、`nodejs/` から `pnpm bump-spec-version 2.1` を実行します。

## 関連プロジェクト

- [illusions-lab/milkdown-mdi](https://github.com/illusions-lab/milkdown-mdi) — MDI 構文と縦書き表示のための Milkdown エディタプラグイン。

## ライセンス

MIT
