[MDI 2.0 specification](./SYNTAX.md) · [日本語 README](./README.ja.md)

# MDI

<p align="center">
  <strong>Markdown tooling for Japanese typography</strong><br />
  Ruby, tate-chu-yoko, boten, warichu, vertical writing, and more.
</p>

<p align="center">
  <a href="https://mdi.illusions.app/">
    <img src="https://img.shields.io/badge/Read%20the%20documentation-0B7285?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Read the MDI documentation" />
  </a>
</p>

## What is MDI?

**illusion Markdown (MDI)** is Markdown for Japanese publishing. It preserves the Markdown you already know while adding the typography that Japanese prose needs: ruby readings, tate-chu-yoko, boten, warichu, vertical writing, and page-aware output.

Write an `.mdi` document once, then render it as HTML, PDF, EPUB, DOCX, or text formats for platforms such as note, Kakuyomu, Narou, and Aozora Bunko. Ordinary CommonMark and GFM remain valid MDI, so you can introduce MDI features only where your document needs them.

```mdi
# 春は曙

{東京|とうきょう}で第^12^話を読む。
```

## One parser, written in Rust

[`mdi-core`](./mdi-core) is the canonical Rust implementation of the MDI grammar. It parses CommonMark, GFM, YAML front matter, and MDI extensions into a versioned document IR, then provides deterministic HTML, TXT, EPUB, DOCX, and PDF renderers.

The language toolkits below call this same parser instead of reimplementing the grammar. That means an MDI document has consistent syntax, diagnostics, and rendering semantics everywhere it runs.

## Language toolkits

| Language | Toolkit | Documentation |
| --- | --- | --- |
| Rust | [`mdi-core`](./mdi-core) | <a href="https://mdi.illusions.app/bindings/rust/"><img src="https://img.shields.io/badge/Rust%20docs-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust documentation" /></a> |
| JavaScript / TypeScript | [`nodejs/`](./nodejs) | <a href="https://mdi.illusions.app/bindings/javascript/"><img src="https://img.shields.io/badge/JavaScript%20%2F%20TypeScript%20docs-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript and TypeScript documentation" /></a> |
| Python | [`python/`](./python) | <a href="https://mdi.illusions.app/bindings/python/"><img src="https://img.shields.io/badge/Python%20docs-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python documentation" /></a> |
| Swift | [`swift/`](./swift) | <a href="https://mdi.illusions.app/bindings/swift/"><img src="https://img.shields.io/badge/Swift%20docs-F05138?style=flat-square&logo=swift&logoColor=white" alt="Swift documentation" /></a> |
| Android / Kotlin *(in development)* | [`android/`](./android) | <a href="https://mdi.illusions.app/bindings/android/"><img src="https://img.shields.io/badge/Android%20%2F%20Kotlin%20docs-3DDC84?style=flat-square&logo=android&logoColor=black" alt="Android and Kotlin documentation" /></a> |

> **Android / Kotlin status:** the binding is still in development and is not yet published as a stable public package on Maven Central.


## Repository layout

| Directory | Responsibility |
| --- | --- |
| [`mdi-core/`](./mdi-core) | Rust parser, versioned IR, validation, serialization, and deterministic renderers. |
| [`nodejs/`](./nodejs) | JavaScript/WASM bindings, ecosystem adapters, CLI, and documentation. |
| [`python/`](./python) | PyO3 binding to `mdi-core`. |
| [`swift/`](./swift) | UniFFI or C-ABI binding to `mdi-core`. |
| [`android/`](./android) | Android Kotlin/JNI binding, native build scripts, and Android contract. |
| [`mdi-android-jni/`](./mdi-android-jni) | Android-only JNI façade over `mdi-core`. |

## Node.js packages

| Package | Purpose |
| --- | --- |
| [`@illusions-lab/mdi`](./nodejs/packages/mdi) | Primary typed JavaScript API backed by Rust. |
| [`@illusions-lab/mdi-core`](./nodejs/packages/mdi-core) | Generated low-level WebAssembly bridge. |
| [`@illusions-lab/mdi-cli`](./nodejs/packages/cli) | Rust-backed command-line adapter. |
| [`@illusions-lab/mdi-to-pdf`](./nodejs/packages/to-pdf) | Chromium layout adapter for Rust-rendered HTML. |
| [`@illusions-lab/mdi-remark`](./nodejs/packages/remark), [`mdast-util-mdi`](./nodejs/packages/mdast-util-mdi) | Rust-backed Unified ecosystem adapters. |
| [`@illusions-lab/mdi-to-hast`](./nodejs/packages/to-hast), [`@illusions-lab/mdi-to-html`](./nodejs/packages/to-html), [`@illusions-lab/mdi-to-epub`](./nodejs/packages/to-epub), [`@illusions-lab/mdi-to-docx`](./nodejs/packages/to-docx) | Legacy public compatibility adapters. |
| [`@illusions-lab/mdi-export-profile`](./nodejs/packages/export-profile) | Shared typed export-profile configuration. |

## Project status

[![CI](https://img.shields.io/github/actions/workflow/status/illusions-lab/MDI/ci.yml/CI?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI)](https://github.com/illusions-lab/MDI/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/github/actions/workflow/status/illusions-lab/MDI/docs.yml/Docs?branch=main&style=for-the-badge&logo=readthedocs&logoColor=white&label=Docs)](https://github.com/illusions-lab/MDI/actions/workflows/docs.yml)
[![codecov](https://codecov.io/gh/illusions-lab/MDI/graph/badge.svg?token=J6GJZW744R)](https://codecov.io/gh/illusions-lab/MDI)
[![npm version](https://img.shields.io/npm/v/%40illusions-lab%2Fmdi?style=for-the-badge&logo=npm&logoColor=white&label=npm)](https://www.npmjs.com/package/@illusions-lab/mdi)
[![License](https://img.shields.io/github/license/illusions-lab/MDI?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](./LICENSE)

## Development

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

Building the WASM bridge also requires the `wasm32-unknown-unknown` Rust target and `wasm-pack`; the Node workspace build runs it automatically. CI first runs the unit and coverage suites for Node.js, Rust (Linux, macOS, and Windows on x64 and ARM64), Swift, Python, and Android. Only after they pass does it validate publication output with the .NET Open XML SDK, LibreOffice, Chromium, W3C EPUBCheck, and HTML contracts.

## Releases

Package versions use `<MDI spec version>.<package release number>`; for MDI 2.0, releases begin at `2.0.1`. Use a patch Changeset for ordinary releases. Merging to `main` makes GitHub Actions build and publish packages through npm Trusted Publishing (OIDC).

```bash
cd nodejs
pnpm changeset
pnpm version
```

For an MDI specification version bump, run `pnpm bump-spec-version 2.1` from `nodejs/`.

## Related project

- [illusions-lab/milkdown-mdi](https://github.com/illusions-lab/milkdown-mdi) — Milkdown editor plugins for MDI syntax and vertical-writing display.

## License

MIT
