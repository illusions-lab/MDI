# @illusions-lab/mdi-to-pdf

## Unreleased

### Patch Changes

- Add the browser-safe `@illusions-lab/mdi-to-pdf/profile` entry for applying
  Chromium print profiles without importing Playwright or launching Chromium.
- Make all blank-paragraph spellings reserve one logical strict-grid column in
  vertical Chromium layout.

## 2.0.18

### Patch Changes

- Make Rust the direct CLI path for HTML, text, EPUB, and DOCX. PDF now receives
  Rust-rendered HTML before Chromium layout, and the CLI no longer ships its
  duplicate mdast text or document renderers.
  - @illusions-lab/mdi-to-html@2.0.18

## 2.0.5

### Patch Changes

- @illusions-lab/mdi-to-html@2.0.5

## 2.0.4

### Patch Changes

- @illusions-lab/mdi-to-html@2.0.4

## 2.0.3

### Patch Changes

- Complete converter implementations targeting MDI 2.0: the shared mdast → hast mapping with the default MDI stylesheet, HTML document output, PDF via headless Chromium (correct `vertical-rl` / `text-combine-upright` / `text-emphasis`), EPUB 3 packaging with spine split on page breaks, native-OOXML DOCX (`<w:ruby>`, `<w:eastAsianLayout>`, vertical sections), and the `mdi build` CLI.
- Updated dependencies
  - @illusions-lab/mdi-to-html@2.0.3
