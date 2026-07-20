# `@illusions-lab/mdi-remark`

Unified/remark adapter for the Rust-authoritative MDI engine.

## Install

```sh
npm install @illusions-lab/mdi-remark unified remark-parse remark-stringify
```

The adapter sends the complete source document to `mdi-core`, exposes the
resulting versioned document IR as mdast to a unified pipeline, and converts a
modified mdast tree back to Rust IR when the pipeline needs MDI serialization
or another output format.

```text
source → mdi-core → Rust IR ⇄ mdast → unified plugins
```

It does not extend remark's tokenizer and does not implement CommonMark, GFM,
front matter, or MDI syntax. All parsing, boundary decisions, validation,
normalization, serialization, and renderer semantics remain in Rust.

## Usage

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkMdi from "@illusions-lab/mdi-remark";

const processor = unified().use(remarkParse).use(remarkMdi).use(remarkStringify);
const tree = processor.parse("{東京|とうきょう} ^12^");
const output = String(await processor.process("[[em:傍点]]"));
```

Use [`@illusions-lab/mdi`](../mdi) directly when unified plugins are not
required. This package exists only to connect the same Rust parse result to the
remark ecosystem.

Part of the [MDI](https://github.com/illusions-lab/MDI) monorepo. See the
[architecture documentation](https://mdi.illusions.app/guides/architecture/)
for ownership and wire-contract details.

## Documentation

- [Remark / mdast adapter guide](https://mdi.illusions.app/ecosystem/remark/)
- [JavaScript binding guide](https://mdi.illusions.app/bindings/javascript/)
- [MDI documentation](https://mdi.illusions.app/)
