# @illusions-lab/mdi-core

## 2.0.2

### Patch Changes

- Make Rust the direct CLI path for HTML, text, EPUB, and DOCX. PDF now receives
  Rust-rendered HTML before Chromium layout, and the CLI no longer ships its
  duplicate mdast text or document renderers.
- Publish the generated JavaScript, declarations, and WebAssembly binary in
  the npm tarball.
