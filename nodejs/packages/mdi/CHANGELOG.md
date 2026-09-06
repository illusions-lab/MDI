# @illusions-lab/mdi

## Unreleased

- Add Rust-owned automatic warichu fragments and a presentation-only layout API; render native DOCX two-line text. Add first/continuation capacities, UTF-8 source mappings and portable fragment HTML; adaptive editor integration is a separate consumer gate.
## 2.0.21

### Patch Changes

- Isolate Rust-owned mdast provenance under `@illusions-lab/mdi/internal/mdast`
  and keep it out of general parsing and text projection.
- Updated dependencies
  - @illusions-lab/mdi-core@2.0.21

## 2.0.2

### Patch Changes

- Make Rust the direct CLI path for HTML, text, EPUB, and DOCX. PDF now receives
  Rust-rendered HTML before Chromium layout, and the CLI no longer ships its
  duplicate mdast text or document renderers.
- Updated dependencies
  - @illusions-lab/mdi-core@2.0.2
