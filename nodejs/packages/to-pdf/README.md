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

## Electron and Web Chromium hosts

Use the browser-safe profile entry when the application already owns Chromium.
It does not import Playwright, Node built-ins, or launch a browser.

```ts
import { prepareChromiumPrintProfile } from "@illusions-lab/mdi-to-pdf/profile";

const print = prepareChromiumPrintProfile(html, profile, sourceWritingMode);
// Load print.html into an Electron BrowserWindow or an iframe and print it.
// print.page has physical millimetre dimensions and margins.
// print.pageNumbers contains optional Chromium header/footer templates.
```

`applyPdfProfile(html, resolvedProfile)` is also exported from this entry for
hosts that already resolve their profile. Browser hosts should use `print.html`
for the shared CSS layout; page-number headers and footers remain host-specific.

## What this package owns

```text
MDI source → Rust parser + HTML renderer → Chromium layout → PDF bytes
```

Rust resolves the page size, margins, writing mode, type settings, and page
number templates. This package owns the final host step: loading that prepared
HTML in Chromium and requesting PDF bytes. It never receives MDI source and
cannot make syntax, profile-validation, or semantic-rendering decisions.

## Documentation

- [Rendering and Chromium boundary](https://mdi.illusions.app/core/rendering/)
- [Export-profile guide](https://mdi.illusions.app/ecosystem/export-profiles/)
- [API reference](https://mdi.illusions.app/api/to-pdf/)
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)

Print hosts must pass `prepared.page` to `settleMdiPrintLayout(evaluate, { page: prepared.page })`. The Node PDF adapter does this automatically, constraining measurement to the physical printable page before font/layout stabilization.
