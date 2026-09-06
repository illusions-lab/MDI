# @illusions-lab/mdi-core

## Unreleased

- Add Rust-owned automatic warichu fragments and a presentation-only layout API; render native DOCX two-line text. Add first/continuation capacities, UTF-8 source mappings and portable fragment HTML; adaptive editor integration is a separate consumer gate.
## 2.0.21

### Patch Changes

- Add the Rust-owned mdast provenance transport used by the internal remark
  adapter without changing the general parse or text-projection contracts.

## 2.0.2

### Patch Changes

- Make Rust the direct CLI path for HTML, text, EPUB, and DOCX. PDF now receives
  Rust-rendered HTML before Chromium layout, and the CLI no longer ships its
  duplicate mdast text or document renderers.
- Publish the generated JavaScript, declarations, and WebAssembly binary in
  the npm tarball.
