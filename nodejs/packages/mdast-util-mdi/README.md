# `mdast-util-mdi`

Serialization extension and TypeScript node definitions for MDI-flavoured
mdast trees. It lets an existing unified pipeline write MDI nodes back to
canonical MDI source with `mdast-util-to-markdown`.

## Install

```sh
npm install mdast-util-mdi mdast-util-to-markdown
```

## Usage

```ts
import { toMarkdown } from "mdast-util-to-markdown";
import { mdiToMarkdown } from "mdast-util-mdi";

const source = toMarkdown(
  { type: "root", children: [{ type: "paragraph", children: [{ type: "mdiTcy", value: "12" }] }] },
  { extensions: [mdiToMarkdown()] },
);
// ^12^\n
```

This package does not parse MDI source and contains no tokenizer, grammar
tables, delimiter matching, or literal-fallback rules. Parse complete source
with [`@illusions-lab/mdi`](https://www.npmjs.com/package/@illusions-lab/mdi);
Rust remains the sole executable syntax authority.

Part of the [MDI](https://github.com/illusions-lab/MDI) monorepo. See the
[architecture documentation](https://mdi.illusions.app/guides/architecture/)
for ownership and wire-contract details.

## Documentation

- [Remark / mdast adapter guide](https://mdi.illusions.app/ecosystem/remark/)
- [API reference](https://mdi.illusions.app/api/mdast-util-mdi/)
- [MDI documentation](https://mdi.illusions.app/)
