# MDI

[日本語](./README.ja.md)

[![CI](https://img.shields.io/github/actions/workflow/status/illusions-lab/MDI/ci.yml/CI?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI)](https://github.com/illusions-lab/MDI/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/github/actions/workflow/status/illusions-lab/MDI/docs.yml/Docs?branch=main&style=for-the-badge&logo=readthedocs&logoColor=white&label=docs)](https://github.com/illusions-lab/MDI/actions/workflows/docs.yml)
[![Release](https://img.shields.io/github/actions/workflow/status/illusions-lab/MDI/release.yml/Release?branch=main&style=for-the-badge&logo=github&logoColor=white&label=release)](https://github.com/illusions-lab/MDI/actions/workflows/release.yml)
[![codecov](https://img.shields.io/codecov/c/github/illusions-lab/MDI?style=for-the-badge&logo=codecov&logoColor=white)](https://app.codecov.io/gh/illusions-lab/MDI)
[![npm version](https://img.shields.io/npm/v/%40illusions-lab%2Fmdi?style=for-the-badge&logo=npm&logoColor=white&label=npm)](https://www.npmjs.com/package/@illusions-lab/mdi)
[![npm downloads](https://img.shields.io/npm/dm/%40illusions-lab%2Fmdi?style=for-the-badge&logo=npm&logoColor=white&label=downloads)](https://www.npmjs.com/package/@illusions-lab/mdi)
[![Latest release](https://img.shields.io/github/v/release/illusions-lab/MDI?display_name=tag&sort=semver&style=for-the-badge&logo=github&logoColor=white)](https://github.com/illusions-lab/MDI/releases)
[![License](https://img.shields.io/github/license/illusions-lab/MDI?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](./LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/illusions-lab/MDI?style=for-the-badge&logo=git&logoColor=white)](https://github.com/illusions-lab/MDI/commits/main)
[![Repository size](https://img.shields.io/github/repo-size/illusions-lab/MDI?style=for-the-badge&logo=github&logoColor=white)](https://github.com/illusions-lab/MDI)
[![GitHub stars](https://img.shields.io/github/stars/illusions-lab/MDI?style=for-the-badge&logo=github&logoColor=white)](https://github.com/illusions-lab/MDI/stargazers)

**illusion Markdown (MDI)** is a Markdown extension for Japanese typography. It adds ruby, tate-chu-yoko, boten, warichu, vertical writing, and related features while retaining standard Markdown.

This is the canonical repository for the [MDI 2.0 specification](./SYNTAX.md), the Rust implementation, language bindings, renderers, and developer tools.

Documentation: <https://mdi.illusions.app/>

## Quick start

### CLI — convert an `.mdi` file

Install the CLI, then render an MDI document to standalone HTML:

```bash
npm install --global @illusions-lab/mdi-cli

mdi build novel.mdi --to html -o dist/novel.html
```

The same command can produce `pdf`, `epub`, `docx`, `txt`, `txt-ruby`,
`narou`, `kakuyomu`, or `aozora` output. Run `mdi build novel.mdi --to txt-all`
to write every text variant beside the source file.

### JavaScript — parse and render

Install the JavaScript binding:

```bash
npm install @illusions-lab/mdi
```

```js
import { parse, renderHtml } from "@illusions-lab/mdi";

const source = "# 春は曙\n\n{東京|とうきょう}で第^12^話を読む。";
const { document, diagnostics } = parse(source);
const html = renderHtml(source);

console.log(document);    // Versioned MDI document IR
console.log(diagnostics); // Syntax diagnostics, if any
console.log(html);        // Standalone HTML rendered by Rust
```

<p align="center">
  <a href="https://mdi.illusions.app/">
    <img src="https://img.shields.io/badge/Other%20languages-Read%20the%20documentation-0B7285?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Other languages: read the MDI documentation" />
  </a>
</p>

For Rust, Python, Swift, renderer configuration, and complete API guidance,
visit the <a href="https://mdi.illusions.app/">MDI documentation</a>.

## Architecture

Rust is the single executable authority for MDI syntax and document semantics. It parses CommonMark, GFM, front matter, and MDI extensions into a versioned document IR. JavaScript, Python, and Swift are thin host interfaces over that implementation.

`mdi-core` owns parsing, validation, normalization, serialization, and deterministic HTML, TXT, EPUB, and DOCX rendering. PDF uses Rust-produced HTML; a host Chromium adapter performs only print layout and never parses MDI.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for ownership rules and interface contracts.

## Repository layout

| Directory | Responsibility |
| --- | --- |
| [`mdi-core/`](./mdi-core) | Rust parser, versioned IR, validation, serialization, and deterministic renderers. |
| [`nodejs/`](./nodejs) | JavaScript/WASM bindings, ecosystem adapters, CLI, and documentation. |
| [`python/`](./python) | PyO3 binding to `mdi-core`. |
| [`swift/`](./swift) | UniFFI or C-ABI binding to `mdi-core`. |

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

Building the WASM bridge also requires the `wasm32-unknown-unknown` Rust target and `wasm-pack`; the Node workspace build runs it automatically. CI tests the Rust core on Linux, macOS, and Windows for x64 and ARM64, and runs the JavaScript integration suite including Chromium PDF output on Linux x64.

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
