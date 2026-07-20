# `@illusions-lab/mdi-export-profile`

Typed export-profile schema shared by MDI output adapters. A profile controls
presentation and metadata—page geometry, typography, page numbers, EPUB
chapters, and publication-text options—without changing MDI syntax.

## Install

```sh
npm install @illusions-lab/mdi-export-profile
```

## Usage

```ts
import { parseExportProfileJson, resolveExportProfile } from "@illusions-lab/mdi-export-profile";

const profile = resolveExportProfile({
  metadata: { title: "A short work", language: "ja" },
  typesetting: { writingMode: "vertical", fontFamily: "Noto Serif JP" },
});

const fromFile = parseExportProfileJson('{"pagination":{"pageSize":"A5"}}');
```

Use the resolved profile with the JavaScript PDF/mdast adapters or pass a JSON
profile to `mdi build --config export.json`. Rust remains responsible for MDI
syntax and document semantics.

## Documentation

- [Export-profile guide](https://mdi.illusions.app/guides/export-profiles/)
- [API reference](https://mdi.illusions.app/api/export-profile/)
- [MDI documentation](https://mdi.illusions.app/)
