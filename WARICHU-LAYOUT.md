# Automatic warichu layout

Status: Rust renderer and adaptive browser adapter implemented. Editor integration
and cross-product release gates are tracked separately. Existing syntax and document IR are unchanged.

## Decisions

Source: [W3C JLREQ §3.4](https://www.w3.org/TR/jlreq/#inline_cutting_note).
The renderer uses two lines with zero line gap. The 50% body size is this
implementation's default, not a universal JLREQ requirement. Horizontal layout
places the first line above the second; vertical-rl places it on the right.
Authored parentheses remain authored text; none are added or removed.

`layout_warichu(children, capacity)` operates on parsed inline IR and returns
transient fragments. `layoutMdiWarichu` exposes the same calculation through
Node/WASM. Capacity and returned widths use half-em units at the note's font size.
ASCII and halfwidth kana graphemes count as one half-em; other graphemes count as
two. Ruby readings and markup are excluded. Ruby, tcy, no-break, and unknown
containers stay indivisible. Common inline formatting is carried across splits.
Legal midpoint candidates are ranked by capacity, balance, then first-line length.
A conservative Japanese punctuation/small-kana prohibition prevents illegal
internal boundaries. Explicit `[[br]]` remains a hard boundary, including repeats.
Oversized units are retained and diagnosed by `overflow` / `data-mdi-overflow`.

HTML and EPUB use precomputed spans in source reading order. No script is needed.
PDF waits for fonts and converged host-measured Rust layout before printing. Pure text and canonical MDI never receive automatic breaks.

DOCX uses native `w:eastAsianLayout` with `w:combine="1"`, no added brackets, and
one group ID per note across normal formatted runs. Word determines the split.
See [Microsoft EastAsianLayout documentation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.eastasianlayout?view=openxml-3.0.1).
This is not a claim of tested Microsoft Word rendering. Native ruby and tcy are kept in the note group; reader appearance still needs
interoperability testing.

## Limits and remaining integration

Static no-script rendering uses 40 half-em units (20 note em) per line.
The browser adapter measures remaining space and responds to resizing, fonts,
zoom and writing mode. Indivisible contents can overflow narrow containers.
External parentheses have headless Chromium, Firefox and WebKit geometry tests.
Proportional font visual balance is not guaranteed by character estimates.
Reader reflow may differ from the tested browsers.

Milkdown editing, prepared-document/provenance/clipboard operations, Illusions
entry points, and complete product release verification are separate gates.
Do not interpret renderer tests as completion of the three-repository feature.

## Verification

- `cargo test --manifest-path mdi-core/Cargo.toml --test warichu_layout`
- `pnpm --filter @illusions-lab/mdi exec vitest run src/warichu.test.ts`
- `node nodejs/scripts/test-warichu-layout.mjs` (headless Chromium geometry)
- Run the repository's full Rust, Node coverage, build, and publication contracts
  before shipping. Do not lower coverage thresholds.

Custom formatting and the future draft-preview window are tracked separately in
[MDI #85](https://github.com/illusions-lab/MDI/issues/85); no private syntax or local
metadata implements those settings.

## Browser adapter implementation update

The JavaScript package now exposes `attachMdiWarichuLayout` and a host-driven
`settleMdiPrintLayout`. The adapter measures first-line remaining capacity and
continuation capacity, asks Rust for source-mapped fragments, and writes only
presentation spans. It observes font, resize, and style changes; local changes
invalidate their containing paragraph. Static legacy mdast rendering now uses
the same Rust splitter. Authored hard breaks are retained, including repeats.

Packed consumers have been exercised headlessly in Chromium, Firefox, and
WebKit for two-line horizontal/vertical geometry, multi-line wrapping,
iframe ownership, resize source preservation, and repeated hard breaks.
These are browser tests, not EPUB reading-system or native OS IME tests.
The editor and complete release quality gates must still pass before the
three-repository feature can be called complete.

## Physical print page measurement

Print hosts pass the Rust-resolved `prepared.page` to
`settleMdiPrintLayout(evaluate, { page: prepared.page, timeoutMs, signal })`.
The bridge constrains the temporary print body's inline extent to the printable
paper area before reading geometry. It then measures rendered row advances and
inherited text insets to refine the capacities supplied to Rust. Tracking and
paragraph indentation are retained; no JavaScript splitting algorithm is added.
This prevents screen-window dimensions from causing clipped notes or Chromium
shrink-to-fit during printing. Long 720-character A5 notes are checked in both
writing directions for complete PDF text and unchanged body/note glyph sizes.
This does not promise exact proportional-font balance.
