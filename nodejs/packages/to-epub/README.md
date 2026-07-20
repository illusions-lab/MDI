# @illusions-lab/mdi-to-epub

Creates an EPUB 3 archive from an MDI-flavoured mdast tree. The adapter keeps
support for profile metadata, chapter splitting, cover images, and unified
integration; it does not parse MDI.

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
The Rust-first CLI follows that route.

## Documentation

- [Output model](https://mdi.illusions.app/ecosystem/outputs/)
- [Export-profile guide](https://mdi.illusions.app/guides/export-profiles/)
- [API reference](https://mdi.illusions.app/api/to-epub/)
- [MDI documentation](https://mdi.illusions.app/)
