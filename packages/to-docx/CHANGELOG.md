# @illusions-lab/mdi-to-docx

## 2.0.4

### Patch Changes

- Updated dependencies
  - mdast-util-mdi@2.0.3

## 2.0.3

### Patch Changes

- Complete converter implementations targeting MDI 2.0: the shared mdast → hast mapping with the default MDI stylesheet, HTML document output, PDF via headless Chromium (correct `vertical-rl` / `text-combine-upright` / `text-emphasis`), EPUB 3 packaging with spine split on page breaks, native-OOXML DOCX (`<w:ruby>`, `<w:eastAsianLayout>`, vertical sections), and the `mdi build` CLI.
- Updated dependencies
  - mdast-util-mdi@2.0.2
