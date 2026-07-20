# @illusions-lab/mdi-to-hast

Converts an MDI-flavoured mdast tree into HAST and exposes the matching MDI CSS
and `remark-rehype` handler table. It is for existing unified ecosystems; it
does not parse MDI or decide syntax.

## Install

```sh
npm install @illusions-lab/mdi-to-hast
```

## Usage

```ts
import { mdiToHast, MDI_STYLESHEET } from "@illusions-lab/mdi-to-hast";

const { hast, frontmatter } = mdiToHast(mdastTree);
console.log(hast, frontmatter, MDI_STYLESHEET);
```

For complete `.mdi` source, prefer `renderHtml()` from
[`@illusions-lab/mdi`](https://www.npmjs.com/package/@illusions-lab/mdi): Rust
parses and renders the document directly. Use this package only when a unified
pipeline already owns an mdast tree.

## Documentation

- [Remark / mdast adapter guide](https://mdi.illusions.app/ecosystem/remark/)
- [API reference](https://mdi.illusions.app/api/to-hast/)
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)
