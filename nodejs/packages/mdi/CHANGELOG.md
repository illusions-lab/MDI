# @illusions-lab/mdi

## 2.1.0 — Editorial comments

- Preserve `<!-- ... -->` in canonical source, including older 2.0 documents.
- Keep default document APIs on comment-free IR 1.0; explicitly request comments for IR 1.1.
- Always omit valid comments from body projections, layout and publications. Previously visible HTML comment text is now omitted.
- Warn on unterminated comments and retain their literal text; intended private text may therefore be exported.

## Unreleased

- Fix long notes clipping or shrinking during PDF output by measuring the physical printable page and actual glyph advances, including inherited tracking and indentation.

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
