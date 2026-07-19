import { codes } from "micromark-util-symbol";
import type { Code } from "micromark-util-types";

/**
 * MDI constructs grouped by family. Families share a tokenizer shape;
 * members differ only in name/param parsing. Matches SYNTAX.md's own
 * grouping in "Parsing Order" — the two `[[...]]`-looking families
 * (bracket macros vs. block macros) are listed in different stages there
 * (inline stage item 9 vs. block stage item 4) and MUST stay separate
 * constructs here too, even though their surface syntax looks identical:
 * they run in different micromark content types (text vs. flow), so there
 * is no runtime ambiguity despite the shared `[[` trigger.
 */
export type MdiConstructFamily =
	| "ruby" // {base|ruby} — text
	| "tcy" // ^text^ — text
	| "botenAlias" // 《《text》》 — text, normalizes to the same mdast node as em
	| "bracketMacro" // [[br]] [[no-break:..]] [[em:..]] [[warichu:..]] [[kern:..:..]] — text
	| "blank" // \ / <br> / [[blank]] (alternate spellings, one mdast node) — flow
	| "blockMacro"; // [[pagebreak]] [[indent:N]] [[bottom]] [[bottom:N]] — flow

export type MdiContentType = "text" | "flow";

export interface MdiConstructInfo {
	family: MdiConstructFamily;
	contentType: MdiContentType;
	/** Character code(s) that can start this construct. */
	triggers: Code[];
	/**
	 * Whether this construct needs a resolveAll pass (CommonMark-style
	 * delimiter stack + backtracking, as emphasis/links need). Every MDI
	 * construct here is deterministic single-pass instead: bracket macros
	 * nest by simple depth-counting rather than ambiguous
	 * reference-fallback matching, so none of them need it.
	 */
	needsResolveAll: false;
	/** Must be tried as a paragraph-interrupting flow construct. */
	interruptsParagraph: boolean;
}

const CJK_LEFT_DOUBLE_ANGLE = 0x300a; // 《
const CJK_RIGHT_DOUBLE_ANGLE = 0x300b; // 》

export const mdiConstructs: Record<MdiConstructFamily, MdiConstructInfo> = {
	ruby: {
		family: "ruby",
		contentType: "text",
		triggers: [codes.leftCurlyBrace],
		needsResolveAll: false,
		interruptsParagraph: false,
	},
	tcy: {
		family: "tcy",
		contentType: "text",
		triggers: [codes.caret],
		needsResolveAll: false,
		interruptsParagraph: false,
	},
	botenAlias: {
		family: "botenAlias",
		contentType: "text",
		triggers: [CJK_LEFT_DOUBLE_ANGLE],
		needsResolveAll: false,
		interruptsParagraph: false,
	},
	bracketMacro: {
		family: "bracketMacro",
		contentType: "text",
		triggers: [codes.leftSquareBracket],
		needsResolveAll: false,
		interruptsParagraph: false,
	},
	blank: {
		family: "blank",
		contentType: "flow",
		// \  and  <br> / <br />  and  [[blank]]  — three spellings, one node.
		triggers: [codes.backslash, codes.lessThan, codes.leftSquareBracket],
		needsResolveAll: false,
		interruptsParagraph: true,
	},
	blockMacro: {
		family: "blockMacro",
		contentType: "flow",
		triggers: [codes.leftSquareBracket],
		needsResolveAll: false,
		interruptsParagraph: true,
	},
};

export { CJK_LEFT_DOUBLE_ANGLE, CJK_RIGHT_DOUBLE_ANGLE };

declare module "micromark-util-types" {
	interface TokenTypeMap {
		// Ruby — {base|ruby}
		mdiRuby: "mdiRuby";
		mdiRubyMarker: "mdiRubyMarker";
		mdiRubyBase: "mdiRubyBase";
		mdiRubySeparatorMarker: "mdiRubySeparatorMarker";
		mdiRubyText: "mdiRubyText";

		// Tate-chu-yoko — ^text^
		mdiTcy: "mdiTcy";
		mdiTcyMarker: "mdiTcyMarker";
		mdiTcyText: "mdiTcyText";

		// Boten alias — 《《text》》 (normalizes to mdiEm with the default mark)
		mdiBotenAlias: "mdiBotenAlias";
		mdiBotenAliasMarker: "mdiBotenAliasMarker";
		mdiBotenAliasText: "mdiBotenAliasText";

		// Bracket macros (text/inline) — [[br]] [[no-break:..]] [[em:..]]
		// [[warichu:..]] [[kern:..:..]]. One construct; `mdiBracketMacroName`
		// distinguishes which macro. `mdiBracketMacroContent` is re-entered
		// as ordinary inline content by the main text tokenizer (not a
		// captured-and-resubmitted string), so nested ruby/tcy/bracket
		// macros inside it are just tokenized as they're reached.
		mdiBracketMacro: "mdiBracketMacro";
		mdiBracketMacroMarker: "mdiBracketMacroMarker";
		mdiBracketMacroName: "mdiBracketMacroName";
		mdiBracketMacroParamMarker: "mdiBracketMacroParamMarker";
		mdiBracketMacroParam: "mdiBracketMacroParam";
		mdiBracketMacroContent: "mdiBracketMacroContent";

		// Blank paragraph (flow) — \ / <br> / [[blank]], one mdast node
		mdiBlank: "mdiBlank";
		mdiBlankMarker: "mdiBlankMarker";

		// Block macros (flow) — [[pagebreak]] [[pagebreak:right|left]]
		// [[indent:N]] [[bottom]] [[bottom:N]]
		mdiBlockMacro: "mdiBlockMacro";
		mdiBlockMacroMarker: "mdiBlockMacroMarker";
		mdiBlockMacroName: "mdiBlockMacroName";
		mdiBlockMacroParamMarker: "mdiBlockMacroParamMarker";
		mdiBlockMacroParam: "mdiBlockMacroParam";
	}
}
