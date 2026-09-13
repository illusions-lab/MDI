# @illusions-lab/mdi-to-html

## 2.1.0 — Editorial comments

- Preserve `<!-- ... -->` in canonical source, including older 2.0 documents.
- Keep default document APIs on comment-free IR 1.0; explicitly request comments for IR 1.1.
- Always omit valid comments from body projections, layout and publications. Previously visible HTML comment text is now omitted.
- Warn on unterminated comments and retain their literal text; intended private text may therefore be exported.

## 2.0.18

### Patch Changes

- @illusions-lab/mdi-to-hast@2.0.18

## 2.0.5

### Patch Changes

- @illusions-lab/mdi-to-hast@2.0.5

## 2.0.4

### Patch Changes

- Updated dependencies [1375175]
  - @illusions-lab/mdi-to-hast@2.0.4

## 2.0.3

### Patch Changes

- Complete converter implementations targeting MDI 2.0: the shared mdast → hast mapping with the default MDI stylesheet, HTML document output, PDF via headless Chromium (correct `vertical-rl` / `text-combine-upright` / `text-emphasis`), EPUB 3 packaging with spine split on page breaks, native-OOXML DOCX (`<w:ruby>`, `<w:eastAsianLayout>`, vertical sections), and the `mdi build` CLI.
- Updated dependencies
- Updated dependencies
  - @illusions-lab/mdi-to-hast@2.0.3
