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

## Rust-owned mdast provenance

Every emitted source construct, including the YAML frontmatter node, carries
transient metadata at `node.data.mdiProvenance`. Its version is `1.0`; the
adapter copies the record from Rust without parsing or deriving it. Generic
mdast consumers may ignore `data.mdiProvenance` safely.

```ts
type MdiMdastProvenance = {
  version: "1.0";
  construct: { path: string; type: string };
  span: { startByte: number; endByte: number } | null;
  role: "container" | "textBearing";
  status: "sourceBacked" | "synthetic" | "unmapped";
  targets: Array<
    | { blockIndex: number; channel: "blockText"; range: { start: string; end: string } }
    | { blockIndex: number; channel: "annotation"; annotationIndex: number; range: { start: string; end: string } }
  >;
};
```

`construct.path`, source spans, projection targets, annotation indexes, and
synthetic/unmapped status are all assigned by Rust. The path identifies this
parse result only; it is not persisted. Editor bridges should record this
metadata while building their own document model, then join source-span
resolution through these keys. They must not rebuild provenance using text,
source order, DOM, or editor-tree traversal. Provenance is not serialized to
canonical MDI, Markdown, HTML, clipboard, or persisted-document semantics.
Container records intentionally have no aggregate projection targets; only
text-bearing nodes query the indexed projection map.

## Usage

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkMdi from "@illusions-lab/mdi-remark";
import { initializeMdi } from "@illusions-lab/mdi";

await initializeMdi(); // required in browsers; an immediate no-op in Node.js
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
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)
