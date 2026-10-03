# @illusions-lab/mdi-to-epub

Creates an EPUB 3 archive from an MDI-flavoured mdast tree. The compatibility
entry point keeps unified integration, while profile validation, chapter
splitting, cover packaging, XHTML, and ZIP generation all use the shared Rust
implementation.

## Install

```sh
npm install @illusions-lab/mdi-to-epub
```

## Usage

```ts
import { mdiToEpub } from "@illusions-lab/mdi-to-epub";

const archive = await mdiToEpub(mdastTree, {
  profile: { metadata: { title: "A short work" } },
  cover: { data: coverBytes, mediaType: "image/png" },
});
```

For complete `.mdi` source, use `renderEpub(source)` from
[`@illusions-lab/mdi`](https://www.npmjs.com/package/@illusions-lab/mdi).
The CLI follows that route as well.

## Documentation

- [Output model](https://mdi.illusions.app/ecosystem/outputs/)
- [Export-profile guide](https://mdi.illusions.app/ecosystem/export-profiles/)
- [API reference](https://mdi.illusions.app/api/to-epub/)
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)
