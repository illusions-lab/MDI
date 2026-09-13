# Changelog

## 2.1.0 — Editorial comments

- Preserve `<!-- ... -->` in canonical source, including older 2.0 documents.
- Keep default document APIs on comment-free IR 1.0; explicitly request comments for IR 1.1.
- Always omit valid comments from body projections, layout and publications. Previously visible HTML comment text is now omitted.
- Warn on unterminated comments and retain their literal text; intended private text may therefore be exported.

## Unreleased

- Add Rust-owned automatic warichu layout with first-fragment and continuation capacities.
- Preserve graphemes across formatting boundaries, indivisible inline groups, authored hard breaks and source UTF-8 paths.
- Return portable per-line HTML and retain oversized content with an overflow signal.
- Keep two lines at half body size, including nested notes, without changing syntax, document IR or canonical text.
- Expose thin language APIs; static reader reflow and exact proportional-font balance remain outside the tested guarantees.
