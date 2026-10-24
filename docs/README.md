# MDI documentation

The complete MDI product manual, built with [Astro Starlight](https://starlight.astro.build) and published to https://mdi.illusions.app/ by `.github/workflows/docs.yml` on push to `main`.

MDI の完全なプロダクトマニュアルです。`main` への push 時に GitHub Pages へ自動デプロイされます。

- Locales: 日本語 (root), English (`en/`), 正體中文 (`zh-tw/`). The generated API reference is English-only at `en/api/`.
- MDI syntax in these pages is parsed by `mdi-core` through `@illusions-lab/mdi`; the docs integration adapts the Rust document IR for Astro rendering (see `astro.config.mjs`)
- API reference pages are generated from TSDoc by `starlight-typedoc` on every build — do not edit them by hand

```bash
pnpm dev                   # local dev server
pnpm docs:build            # production build
```
