# `@illusions-lab/mdi-export-profile`

Typed JavaScript interface to MDI's Rust-owned export-profile contract. A
profile controls presentation and metadata—page geometry, typography, page
numbers, EPUB chapters, and publication-text options—without changing MDI
syntax.

## Install

```sh
npm install @illusions-lab/mdi-export-profile
```

## Usage

```ts
import { parseExportProfileJson, resolveExportProfile } from "@illusions-lab/mdi-export-profile";

const profile = resolveExportProfile({
	layout: { system: "japanese-publisher" },
  metadata: { title: "A short work", language: "ja" },
  typesetting: {
    writingMode: "vertical",
    fontFamily: "Noto Serif JP",
    // Explicit line spacing belongs to typographic mode; strict keeps grid cells.
    fontSize: 11,
    lineSpacing: 1.5,
  },
  pagination: { gridMode: "typographic" },
});

const fromFile = parseExportProfileJson(
  '{"layout":{"system":"word"},"pagination":{"pageSize":"A5"}}'
);
```

## Paper-size UI metadata

Japanese labels are part of the public catalogue, alongside stable keys and
physical dimensions. `listPageSizes()` is suitable for a select menu.

```ts
import {
  getPageSizeLabel,
  listPageSizes,
  PAGE_SIZE_LABELS,
} from "@illusions-lab/mdi-export-profile";

getPageSizeLabel("Bunko"); // "文庫判"
PAGE_SIZE_LABELS.ja["JIS-B5"]; // "JIS B5判"
listPageSizes({ locale: "ja" });
// [{ key: "A4", label: "A4判", widthMm: 210, heightMm: 297 }, ...]
```

Use the resolved profile with the JavaScript export APIs, or pass a JSON
profile to `mdi build --config export.json`. Validation, defaults, physical
page dimensions, and renderer-facing values come from `mdi-core`; this package
adds TypeScript types and Japanese UI labels without keeping a second layout
table.

Configured exports must select `layout.system`. The two systems deliberately
do not blend:

- `japanese-publisher` is a strict manuscript grid. Horizontal text uses the
  four-six (`Shirokuban`) 10 pt Mincho 27 × 26 left-bound book default.
  Vertical text uses the A4-landscape, 10.5 pt Mincho 40 × 30 right-bound
  novel-manuscript default, with a 28 mm right binding margin. Both use
  mirrored pages.
- `word` is a flowing Word-style document: A4 by default, 25.4 mm margins on
  all four edges, and no mirrored book gutter. It always uses
  `gridMode: "typographic"`; a strict character grid is rejected.

Other declared paper sizes derive safe values from the selected system. In a
strict grid, `lineSpacing` is rejected; in typographic mode it is the
renderer-owned baseline multiplier. Contest or house formats such as A4
40 × 30 belong in a separate application/preset layer, not in this generic
schema or the MDI parser.

The strict character count is a full-width CJK manuscript grid. It fixes the
printable inline extent, body cell pitch, and line pitch in DOCX/PDF; it does
not falsely treat proportional Latin glyphs, ruby, or inline media as one
fixed-width character each. Applications that need a submission-specific
count should run their own source validation as well.
The older `fontSizePt` and `lineHeight` spellings are accepted as aliases when
reading existing JSON, but new profiles should use `fontSize` and
`lineSpacing`.

## Documentation

- [Export-profile guide](https://mdi.illusions.app/ecosystem/export-profiles/)
- [API reference](https://mdi.illusions.app/api/export-profile/)
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)
