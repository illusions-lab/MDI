# @illusions-lab/mdi-to-pdf

Chromium layout adapter for Rust-rendered MDI HTML. `renderHtmlToPdf()` applies
an export profile and asks Chromium for PDF bytes. It deliberately accepts
HTML, not MDI source: syntax parsing and semantic HTML rendering stay in
`mdi-core`.

## Install

```sh
npm install @illusions-lab/mdi @illusions-lab/mdi-to-pdf
npx playwright install chromium
```

The Playwright browser must be installed on the host that creates PDFs.

```ts
import { renderHtml } from "@illusions-lab/mdi";
import { renderHtmlToPdf } from "@illusions-lab/mdi-to-pdf";

const pdf = await renderHtmlToPdf(renderHtml("# A Rust-owned document"));
```

`mdiToPdf(mdast, profile)` remains available for existing unified consumers,
but new applications should use the Rust-HTML route above.

## What this package owns

```text
MDI source → Rust parser + HTML renderer → Chromium layout → PDF bytes
```

This package owns only the final print-layout step: page size, margins,
writing mode, page numbers, and the browser process. It never receives MDI
source and cannot make syntax or semantic-rendering decisions.

## Documentation

- [Rendering and Chromium boundary](https://mdi.illusions.app/core/rendering/)
- [Export-profile guide](https://mdi.illusions.app/guides/export-profiles/)
- [API reference](https://mdi.illusions.app/api/to-pdf/)
- [MDI documentation](https://mdi.illusions.app/)
