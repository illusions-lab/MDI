import { unescapeMdi as coreUnescapeMdi } from "@illusions-lab/mdi-core";

/**
 * Reverses the SYNTAX.md §13 escapes (`\{` `\}` `\|` `\^` `\[` `\]` `\:`
 * `\《` `\》`, plus a literal `\\`) inside a raw token slice.
 *
 * Most of these characters are standard CommonMark ASCII punctuation, so
 * `\{`/`\}`/`\|`/`\^`/`\[`/`\]`/`\:` are already consumed as ordinary
 * characters by our tokenizers (which don't special-case backslash beyond
 * "don't let it end the scan") rather than by micromark's own
 * `characterEscape` construct — this function is what actually removes the
 * backslash afterwards, once per MDI construct that captures raw text.
 *
 * Delegates to `mdi-core` (the Rust/wasm grammar core) so this rule has a
 * single implementation shared across every MDI host language.
 */
export function unescapeMdi(value: string): string {
	return coreUnescapeMdi(value);
}
