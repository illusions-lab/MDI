# @illusions-lab/mdi-to-hast

## 2.0.4

### Patch Changes

- 1375175: Apply `text-combine-upright` to tate-chu-yoko output in the default MDI stylesheet.

## 2.0.3

### Patch Changes

- Complete converter implementations targeting MDI 2.0: the shared mdast → hast mapping with the default MDI stylesheet, HTML document output, PDF via headless Chromium (correct `vertical-rl` / `text-combine-upright` / `text-emphasis`), EPUB 3 packaging with spine split on page breaks, native-OOXML DOCX (`<w:ruby>`, `<w:eastAsianLayout>`, vertical sections), and the `mdi build` CLI.
- Export `mdiHandlers`, the mdast → hast handler table, so existing `remark-rehype` / `mdast-util-to-hast` pipelines can render MDI nodes without adopting `mdiToHast` — the mdi-js documentation site itself uses this.
- Updated dependencies
  - mdast-util-mdi@2.0.2
  - @illusions-lab/mdi-remark@2.0.3
