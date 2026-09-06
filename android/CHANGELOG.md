# Changelog

## 2.0.2

- Add Rust-owned automatic warichu layout with first-fragment and continuation capacities.
- Preserve graphemes across formatting boundaries, indivisible inline groups, authored hard breaks and source UTF-8 paths.
- Return portable per-line HTML and retain oversized content with an overflow signal.
- Keep two lines at half body size, including nested notes, without changing syntax, document IR or canonical text.
- Expose thin language APIs; static reader reflow and exact proportional-font balance remain outside the tested guarantees.
