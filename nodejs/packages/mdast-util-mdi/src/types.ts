import type { Node, Parent } from "unist";
import type { PhrasingContent } from "mdast";

/**
 * Inline content allowed inside MDI's nestable bracket macros (em, no-break,
 * warichu, kern). Per SYNTAX.md "Inline Nesting": ruby, tate-chu-yoko, and
 * other bracket macros may appear inside these, alongside ordinary
 * CommonMark/GFM phrasing content.
 */
export type MdiPhrasingContent =
	| PhrasingContent
	| MdiRuby
	| MdiTcy
	| MdiBreak
	| MdiEm
	| MdiNoBreak
	| MdiWarichu
	| MdiKern;

/**
 * `{base|ruby}` / `{base|r.u.by}` — SYNTAX.md §2.
 *
 * Leaf node: per the spec, ruby content is plain text with no further MDI
 * or CommonMark inline parsing inside `{...|...}`.
 *
 * `ruby` is a single string for group ruby, or an array of per-base-grapheme
 * strings (same length as `base`'s grapheme cluster count) for split ruby.
 */
export interface MdiRuby extends Node {
	type: "mdiRuby";
	base: string;
	ruby: string | string[];
}

/**
 * `^text^` — SYNTAX.md §3.
 *
 * Leaf node. `value` is always validated against `^[0-9A-Za-z!?]{1,6}$`
 * before this node is produced; anything that doesn't match stays literal
 * text and never reaches mdast as a node.
 */
export interface MdiTcy extends Node {
	type: "mdiTcy";
	value: string;
}

/**
 * `[[br]]` — SYNTAX.md §6.
 *
 * Void inline node, `.mdi`-only. Kept distinct from mdast's built-in
 * `break` (CommonMark trailing-hardbreak) so the tree records which
 * construct produced the line break; `to-hast` emits `<br class="mdi-break">`
 * for this node vs a bare `<br>` for `break`.
 */
export interface MdiBreak extends Node {
	type: "mdiBreak";
}

/**
 * A `\` (or `<br>` / `[[blank]]`, normalized) line — SYNTAX.md §7.
 *
 * Block-level leaf, sibling of `paragraph`/`thematicBreak`. Always a block
 * boundary per the spec, regardless of surrounding blank lines.
 */
export interface MdiBlank extends Node {
	type: "mdiBlank";
}

/**
 * `[[em:text]]` / `[[em:<mark>:text]]`, and the `《《text》》` alias
 * (normalized to this same node type) — SYNTAX.md §4.
 *
 * `mark` is always populated (defaults to "﹅" when omitted or when parsed
 * from the `《《...》》` alias, which never carries a mark).
 */
export interface MdiEm extends Parent {
	type: "mdiEm";
	mark: string;
	children: MdiPhrasingContent[];
}

/** `[[no-break:text]]` — SYNTAX.md §5. */
export interface MdiNoBreak extends Parent {
	type: "mdiNoBreak";
	children: MdiPhrasingContent[];
}

/** `[[warichu:text]]` — SYNTAX.md §8. */
export interface MdiWarichu extends Parent {
	type: "mdiWarichu";
	children: MdiPhrasingContent[];
}

/**
 * `[[kern:<amount>:text]]` — SYNTAX.md §9.
 *
 * `amount` is kept as the raw validated string (e.g. "-0.1em", "+0.3em"),
 * matching `^[+-]?\d+(\.\d+)?em$` — not decomposed into sign/number, since
 * it is only ever round-tripped into a CSS custom property value.
 */
export interface MdiKern extends Parent {
	type: "mdiKern";
	amount: string;
	children: MdiPhrasingContent[];
}

/**
 * `[[pagebreak]]` / `[[pagebreak:right]]` / `[[pagebreak:left]]` —
 * SYNTAX.md §11.
 *
 * Block-level leaf, always its own element (unlike indent/bottom, which
 * annotate an existing block rather than introducing a new one).
 */
export interface MdiPagebreak extends Node {
	type: "mdiPagebreak";
	variant?: "right" | "left";
}

/**
 * `[[indent:N]]` / `[[bottom]]` / `[[bottom:N]]` — SYNTAX.md §10.
 *
 * These are NOT node types. Per the spec's own HTML output (a single
 * `<p class="mdi-indent" style="--mdi-indent:N;">`, not a wrapper element
 * around a `<p>`), block alignment macros attach as `data` on the block
 * node they immediately precede, rather than wrapping it in a Parent node.
 *
 * `mdiIndent` and `mdiBottom` are mutually exclusive on a given block —
 * the spec forbids stacking ("indent and bottom are mutually exclusive by
 * nature"). `mdiBottom: 0` is `[[bottom]]` (no shift); `mdiBottom: N > 0`
 * is `[[bottom:N]]`.
 */
declare module "mdast" {
	interface Data {
		mdiIndent?: number;
		mdiBottom?: number;
	}

	interface PhrasingContentMap {
		mdiRuby: MdiRuby;
		mdiTcy: MdiTcy;
		mdiBreak: MdiBreak;
		mdiEm: MdiEm;
		mdiNoBreak: MdiNoBreak;
		mdiWarichu: MdiWarichu;
		mdiKern: MdiKern;
	}

	interface BlockContentMap {
		mdiBlank: MdiBlank;
		mdiPagebreak: MdiPagebreak;
	}

	// `RootContentMap` is what `Nodes`/`RootContent` are actually built
	// from (see @types/mdast) — it does NOT derive from
	// `PhrasingContentMap`/`BlockContentMap` above, so every custom node
	// must be registered here for downstream mdast tools.
	interface RootContentMap {
		mdiRuby: MdiRuby;
		mdiTcy: MdiTcy;
		mdiBreak: MdiBreak;
		mdiEm: MdiEm;
		mdiNoBreak: MdiNoBreak;
		mdiWarichu: MdiWarichu;
		mdiKern: MdiKern;
		mdiBlank: MdiBlank;
		mdiPagebreak: MdiPagebreak;
	}
}
