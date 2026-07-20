import type { Extension as FromMarkdownExtension } from "mdast-util-from-markdown";
import type { Paragraph, Parent, Root } from "mdast";
import { blockMacroAmount, blockMacroKind, blockMacroVariant, resolveRuby as coreResolveRuby, unescapeMdi, unescapeRubyText as coreUnescapeRubyText } from "@illusions-lab/mdi-core";
import type { MdiEm, MdiKern, MdiNoBreak, MdiRuby, MdiTcy, MdiWarichu } from "./types.js";
import { graphemes } from "./graphemes.js";

declare module "mdast-util-from-markdown" {
	interface CompileData {
		mdiPendingBlockMacro?: PendingBlockMacro | undefined;
		mdiBlockMacrosStacked?: boolean | undefined;
	}
}

/**
 * mdast-util-from-markdown extension for the constructs tokenized by
 * micromark-extension-mdi's `mdi()`.
 *
 * Implements the MDI inline constructs currently supported by the syntax
 * extension; remaining MDI constructs are added incrementally.
 */
export function mdiFromMarkdown(): FromMarkdownExtension {
	return {
		transforms: [resolveBlockMacros],
		enter: {
			mdiBlank(token) {
				this.data.mdiPendingBlockMacro = undefined;
				this.enter({ type: "mdiBlank" }, token);
			},
			mdiBlockMacro(token) {
				const macro = parseBlockMacro(this.sliceSerialize(token));
				if (macro.kind === "pagebreak") {
					this.data.mdiPendingBlockMacro = undefined;
					this.enter(macro.variant ? { type: "mdiPagebreak", variant: macro.variant } : { type: "mdiPagebreak" }, token);
				} else if (macro.kind === "literal") {
					this.enter({ type: "paragraph", children: [{ type: "text", value: macro.source }] }, token);
				} else {
					this.enter({ type: "paragraph", children: [{ type: "text", value: macro.source }], data: { mdiBlockMacro: macro } } as never, token);
				}
			},
			paragraph(token) {
				const macro = this.data.mdiPendingBlockMacro;
				const data = macro && !this.data.mdiBlockMacrosStacked ? { [macro.kind === "indent" ? "mdiIndent" : "mdiBottom"]: macro.amount } : undefined;
				this.data.mdiPendingBlockMacro = undefined;
				this.data.mdiBlockMacrosStacked = undefined;
				this.enter({ type: "paragraph", children: [], ...(data && { data }) } as Paragraph, token);
			},
			mdiBracketMacro(token) {
				const source = this.sliceSerialize(token);
				if (source.startsWith("[[br")) {
					this.enter({ type: "mdiBreak" }, token);
				} else if (source.startsWith("[[no-break:")) {
					this.enter({ type: "mdiNoBreak", children: [] }, token);
				} else if (source.startsWith("[[em:")) {
					this.enter({ type: "mdiEm", mark: "﹅", children: [] }, token);
				} else if (source.startsWith("[[warichu:")) {
					this.enter({ type: "mdiWarichu", children: [] }, token);
				} else {
					const amount = source.slice("[[kern:".length).split(":", 1)[0]!;
					this.enter({ type: "mdiKern", amount: unescapeMdi(amount), children: [] }, token);
				}
			},
			mdiRuby(token) {
				this.enter({ type: "mdiRuby", base: "", ruby: "" }, token);
			},
			mdiTcy(token) {
				this.enter({ type: "mdiTcy", value: "" }, token);
			},
			mdiBotenAlias(token) {
				this.enter({ type: "mdiEm", mark: "﹅", children: [] }, token);
			},
		},
		exit: {
			mdiBlank(token) {
				this.exit(token);
			},
			mdiBlockMacro(token) {
				const macro = parseBlockMacro(this.sliceSerialize(token));
				this.exit(token);
				if (macro.kind === "indent" || macro.kind === "bottom") {
					if (this.data.mdiPendingBlockMacro) this.data.mdiBlockMacrosStacked = true;
					this.data.mdiPendingBlockMacro = macro;
				}
			},
			mdiBracketMacro(token) {
				const node = this.stack[this.stack.length - 1] as MdiEm | MdiKern | MdiNoBreak | MdiWarichu | { type: "mdiBreak" };
				if (node.type === "mdiEm") resolveEm(node, this.sliceSerialize(token));
				this.exit(token);
			},
			mdiRubyBase(token) {
				const node = this.stack[this.stack.length - 1] as MdiRuby;
				node.base = coreUnescapeRubyText(this.sliceSerialize(token));
			},
			mdiRubyText(token) {
				const node = this.stack[this.stack.length - 1] as MdiRuby;
				node.ruby = coreResolveRuby(node.base, this.sliceSerialize(token)) as string | string[];
			},
			mdiRuby(token) {
				this.exit(token);
			},
			mdiTcyText(token) {
				const node = this.stack[this.stack.length - 1] as MdiTcy;
				node.value = unescapeMdi(this.sliceSerialize(token));
			},
			mdiTcy(token) {
				this.exit(token);
			},
			mdiBotenAliasText(token) {
				const node = this.stack[this.stack.length - 1] as MdiEm;
				node.children = [{ type: "text", value: unescapeMdi(this.sliceSerialize(token)) }];
			},
			mdiBotenAlias(token) {
				this.exit(token);
			},
		},
	};
}

type PendingBlockMacro = {
	kind: "indent" | "bottom";
	amount: number;
	source: string;
};

type ParsedBlockMacro = PendingBlockMacro | { kind: "pagebreak"; variant?: "right" | "left" } | { kind: "literal"; source: string };

/** Delegates classification to `mdi-core`; only the JS-side shape (discriminated union vs. three flat calls) differs. */
function parseBlockMacro(source: string): ParsedBlockMacro {
	const value = source.trim();
	const kind = blockMacroKind(value);
	if (kind === "pagebreak") {
		const variant = blockMacroVariant(value);
		return variant === "left" || variant === "right" ? { kind: "pagebreak", variant } : { kind: "pagebreak" };
	}
	if (kind === "indent" || kind === "bottom") {
		return { kind, amount: blockMacroAmount(value), source: value };
	}
	return { kind: "literal", source: value };
}

function resolveBlockMacros(tree: Root): Root {
	visit(tree);
	return tree;
}

function visit(parent: Parent): void {
	const blocked = new Set<number>();
	for (let index = 0; index < parent.children.length - 1; index++) {
		if (pendingMacro(parent.children[index]) && pendingMacro(parent.children[index + 1])) {
			blocked.add(index);
			blocked.add(index + 1);
		}
	}

	for (let index = parent.children.length - 1; index >= 0; index--) {
		const node = parent.children[index]!;
		const macro = pendingMacro(node);
		if (macro) {
			const data = node.data as Record<string, unknown>;
			delete data.mdiBlockMacro;
			if (Object.keys(data).length === 0) delete node.data;
			const next = parent.children[index + 1];
			if (!blocked.has(index) && next && next.type !== "mdiBlank" && next.type !== "mdiPagebreak" && !pendingMacro(next)) {
				next.data = { ...next.data, [macro.kind === "indent" ? "mdiIndent" : "mdiBottom"]: macro.amount };
				parent.children.splice(index, 1);
			}
		}
	}

	for (const child of parent.children) {
		if ("children" in child) visit(child as Parent);
	}
}

function pendingMacro(node: { data?: unknown }): PendingBlockMacro | undefined {
	const macro = (node.data as { mdiBlockMacro?: unknown } | undefined)?.mdiBlockMacro;
	return macro && typeof macro === "object" && "kind" in macro && (macro as PendingBlockMacro).kind !== undefined ? (macro as PendingBlockMacro) : undefined;
}

function resolveEm(node: MdiEm, source: string): void {
	const raw = source.slice("[[em:".length, -2);
	const first = bareColon(raw);
	if (first < 0) return;
	const mark = unescapeMdi(raw.slice(0, first));
	if (graphemes(mark).length !== 1 || /[\s\p{Cc}]/u.test(mark)) return;
	node.mark = mark;
	const prefix = mark + ":";
	const firstChild = node.children[0];
	if (firstChild?.type === "text" && firstChild.value.startsWith(prefix)) {
		firstChild.value = firstChild.value.slice(prefix.length);
		if (firstChild.value.length === 0) node.children.shift();
	}
}

function bareColon(value: string, start = 0): number {
	for (let index = start; index < value.length; index++) {
		if (value[index] === "\\") {
			index++;
		} else if (value[index] === ":") {
			return index;
		}
	}
	return -1;
}

// Split-vs-group ruby resolution (SYNTAX.md §2 "Edge Cases") and ruby-text
// unescaping (the nine §13 delimiters plus ".") now live in mdi-core,
// imported above as coreResolveRuby / coreUnescapeRubyText.
