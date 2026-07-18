# mdi-js

**Node.js tooling for [illusion Markdown (MDI)](https://github.com/illusions-lab/MDI)** — parse `.mdi` files and convert them to HTML, PDF, EPUB, and DOCX.

**illusion Markdown (MDI)** のための Node.js ツール群です。`.mdi` ファイルを解析し、HTML・PDF・EPUB・DOCX へ変換します。

This repository targets **MDI 2.0** ([spec](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)).  
本リポジトリは **MDI 2.0**（[仕様書](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)）に対応します。

---

## Packages / パッケージ構成

| Package | Layer | Description |
|---------|-------|-------------|
| [`micromark-extension-mdi`](./packages/micromark-extension-mdi) | Parser core | Tokenizes MDI inline/block syntax (ruby, tate-chu-yoko, boten, kerning, warichu, blank paragraphs, page breaks, block alignment) on top of CommonMark. |
| [`mdast-util-mdi`](./packages/mdast-util-mdi) | Parser core | Compiles micromark-mdi token events into mdast nodes, and back into markdown. |
| [`@mdi/remark`](./packages/remark) | Parser core | A single `remark` plugin bundling GFM, YAML front matter, and the MDI extensions — the recommended entry point for producing an MDI mdast tree. |
| [`@mdi/to-hast`](./packages/to-hast) | Shared transform | Maps MDI mdast nodes to hast, following the HTML mapping defined in the spec. Shared foundation for the HTML, PDF, and EPUB converters. |
| [`@mdi/to-html`](./packages/to-html) | Converter | Renders hast to an HTML string with the default MDI stylesheet. |
| [`@mdi/to-pdf`](./packages/to-pdf) | Converter | Renders `@mdi/to-html` output to PDF via a headless browser, to get correct `vertical-rl` / `text-combine-upright` / `text-emphasis` support. |
| [`@mdi/to-epub`](./packages/to-epub) | Converter | Serializes `@mdi/to-hast` output to valid EPUB XHTML and packages it (OPF manifest, nav, spine split on chapter/page breaks). |
| [`@mdi/to-docx`](./packages/to-docx) | Converter | Maps mdast directly to OOXML (native `<w:ruby>`, `<w:eastAsianLayout>`, section-level vertical writing) — does not go through HTML. |
| [`@mdi/cli`](./packages/cli) | CLI | `mdi build input.mdi --to html\|pdf\|epub\|docx` — thin wrapper around the converters above. |

### Why this split / なぜこの分割か

Three of the four output formats (HTML, PDF, EPUB) are HTML-family formats and share the same mdast → hast mapping (`@mdi/to-hast`); only DOCX is genuine OOXML and bypasses hast entirely. See the [architecture notes](#architecture--アーキテクチャ) below.

HTML・PDF・EPUB の 3 つは HTML 系フォーマットであり、同じ mdast → hast マッピング（`@mdi/to-hast`）を共有します。DOCX のみ純粋な OOXML であり、hast を経由しません。詳細は下記アーキテクチャ節を参照してください。

---

## Architecture / アーキテクチャ

```
micromark-extension-mdi ─▶ mdast-util-mdi ─▶ @mdi/remark
                                  │
                                  ▼
                            @mdi/to-hast
                             /    │    \
                            /     │     \
                  @mdi/to-html    │   @mdi/to-epub
                       │          │
                  @mdi/to-pdf     ▼
                              @mdi/to-docx  (reads mdast directly)
```

All converters consume the **same mdast tree** produced by `@mdi/remark`, so editor-path and export-path behavior stay in sync (see [SYNTAX.md § Parsing Order](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md#parsing-order--パース順序)).

すべてのコンバータは `@mdi/remark` が生成する**単一の mdast ツリー**を消費するため、エディタ側とエクスポート側の挙動が分岐しません。

---

## Development / 開発

This is a [pnpm](https://pnpm.io) + [Turborepo](https://turbo.build) monorepo.

```bash
pnpm install
pnpm build
pnpm test
```

Versioning and publishing are managed with [Changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset
```

---

## Related projects / 関連プロジェクト

- [illusions-lab/MDI](https://github.com/illusions-lab/MDI) — the MDI specification.
- [illusions-lab/milkdown-mdi](https://github.com/illusions-lab/milkdown-mdi) — Milkdown editor plugins for MDI syntax support and vertical writing (縦書き) display.

---

## License

MIT
