# @illusions-lab/mdi-to-html

Renders an MDI-flavoured mdast tree to a complete HTML document with MDI CSS
and front-matter metadata. It is a compatibility renderer for unified users;
it does not parse MDI source.

## Install

```sh
npm install @illusions-lab/mdi-to-html
```

## Usage

```ts
import { mdiToHtml } from "@illusions-lab/mdi-to-html";

const html = mdiToHtml(mdastTree);
```

For complete source documents, use `renderHtml(source)` from
[`@illusions-lab/mdi`](https://www.npmjs.com/package/@illusions-lab/mdi).
That route parses and renders in Rust, and is what the MDI CLI uses.

## Documentation

- [HTML and output model](https://mdi.illusions.app/ecosystem/outputs/)
- [API reference](https://mdi.illusions.app/api/to-html/)
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)
