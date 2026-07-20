# docs

The MDI Node.js tooling documentation site — [Astro Starlight](https://starlight.astro.build), published to https://mdi.illusions.app/ by `.github/workflows/docs.yml` on push to `main`.

MDI の Node.js ツール群のドキュメントサイトです。`main` への push 時に GitHub Pages へ自動デプロイされます。

- Locales: English (root), 日本語 (`ja/`), 正體中文 (`zh-tw/`)
- MDI syntax in these pages is rendered live by `micromark-extension-mdi` + `mdast-util-mdi` + `mdiHandlers` (see `astro.config.mjs`)
- API reference pages are generated from TSDoc by `starlight-typedoc` on every build — do not edit them by hand

```bash
pnpm --filter docs dev     # local dev server
pnpm --filter docs build   # production build (workspace packages must be built first)
```
