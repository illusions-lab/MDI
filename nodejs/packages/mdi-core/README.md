# `@illusions-lab/mdi-core`

Low-level WebAssembly bindings for the Rust implementation of MDI 2.0.
This package is the executable syntax authority used by the higher-level
[`@illusions-lab/mdi`](https://www.npmjs.com/package/@illusions-lab/mdi)
binding: it parses complete MDI documents, validates and serializes the
versioned document IR, and renders HTML, TXT, EPUB, and DOCX.

## Install

```sh
npm install @illusions-lab/mdi-core
```

## Recommended API

Most JavaScript applications should use `@illusions-lab/mdi` instead. It
provides typed result objects and stable host-boundary checks:

```sh
npm install @illusions-lab/mdi
```

`@illusions-lab/mdi-core` is for tooling that intentionally needs the raw
generated WASM interface, such as a custom language binding or an integration
that transports the Rust JSON IR directly. It is not a second JavaScript
parser and does not contain a JavaScript grammar.

## Ownership boundary

```text
MDI source → Rust/WASM core → versioned document IR / rendered output
```

CommonMark, GFM, front matter, MDI extensions, escapes, nesting, diagnostics,
and literal fallback are all decided in Rust.

## Documentation

- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)
- [JavaScript binding guide](https://mdi.illusions.app/bindings/javascript/)
- [Rust core API](https://mdi.illusions.app/core/rust-api/)
- [Source repository](https://github.com/illusions-lab/MDI)

MIT licensed.
