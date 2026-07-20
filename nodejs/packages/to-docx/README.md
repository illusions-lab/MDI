# @illusions-lab/mdi-to-docx

Creates a DOCX file from an MDI-flavoured mdast tree. It is a profile-aware
compatibility adapter for unified applications and does not parse MDI source.

## Install

```sh
npm install @illusions-lab/mdi-to-docx
```

## Usage

```ts
import { writeFile } from "node:fs/promises";
import { mdiToDocx } from "@illusions-lab/mdi-to-docx";

const document = await mdiToDocx(mdastTree, {
  typesetting: { writingMode: "vertical", fontFamily: "Noto Serif JP" },
});
await writeFile("book.docx", document);
```

For complete `.mdi` source, use `renderDocx(source)` from
[`@illusions-lab/mdi`](https://www.npmjs.com/package/@illusions-lab/mdi).
The MDI CLI uses that Rust route directly.

## Documentation

- [Output model](https://mdi.illusions.app/ecosystem/outputs/)
- [Export-profile guide](https://mdi.illusions.app/guides/export-profiles/)
- [API reference](https://mdi.illusions.app/api/to-docx/)
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)
