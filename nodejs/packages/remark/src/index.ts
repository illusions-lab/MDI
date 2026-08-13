import {
	parse,
	type MdiDocument,
	type MdiMdastProvenance,
	type MdiNode,
} from "@illusions-lab/mdi";
import { mdiToMarkdown } from "mdast-util-mdi";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { Root } from "mdast";
import type {} from "remark-parse";
import type {} from "remark-stringify";
import type { Processor } from "unified";
import { resolveFrontmatter } from "./frontmatter.js";

export const MDI_SPEC_VERSION = "2.0";
export const MDI_MDAST_PROVENANCE_VERSION = "1.0" as const;
export type { MdiMdastProvenance, MdiMdastProvenanceTarget } from "@illusions-lab/mdi";
export type { MdiFrontmatter } from "./frontmatter.js";
export { initializeMdi } from "@illusions-lab/mdi";

/**
 * Unified ecosystem adapter for the Rust-owned MDI parser.
 *
 * `Parser` is deliberately replaced instead of adding micromark extensions:
 * CommonMark, GFM, front matter, and MDI boundaries are decided by
 * `@illusions-lab/mdi` (WASM/Rust), then mapped into ordinary mdast objects.
 */
export default function remarkMdi(this: Processor): void {
	const data = this.data();
	(data.toMarkdownExtensions ??= []).push(mdiToMarkdown());

	// remark-gfm still contributes mdast-to-markdown handlers for serialization.
	// Its parser hooks are never reached because this adapter owns `Parser`.
	this.use(remarkGfm);
	this.use(remarkFrontmatter, ["yaml"]);
	(this as unknown as { parser: (source: string) => Root }).parser = (source) => {
		const tree = toMdast(parse(source).document);
		resolveFrontmatter(tree);
		return tree;
	};
}

function toMdast(document: MdiDocument): Root {
	const children = document.children.map(toMdastNode) as unknown as Root["children"];
	if (document.frontmatter) {
		children.unshift({ type: "yaml", value: document.frontmatter.raw });
	}
	return { type: "root", children };
}

function toMdastNode(node: MdiNode): Record<string, unknown> {
	const { span: _span, mdiProvenance, children, ...rest } = node;
	const mapped: Record<string, unknown> = { ...rest };
	if (children) mapped.children = children.map(toMdastNode);
	// This is a lossless transport of Rust-owned metadata. It deliberately
	// lives under `data` so ordinary mdast consumers can ignore it.
	if (mdiProvenance) mapped.data = { mdiProvenance };

	switch (node.type) {
		case "ruby": {
			const ruby = node.ruby as { type: string; value: string | string[] };
			return { ...mapped, type: "mdiRuby", ruby: ruby.value };
		}
		case "tcy": return { ...mapped, type: "mdiTcy" };
		case "break": return { ...mapped, type: "mdiBreak" };
		case "em": return { ...mapped, type: "mdiEm" };
		case "noBreak": return { ...mapped, type: "mdiNoBreak" };
		case "warichu": return { ...mapped, type: "mdiWarichu" };
		case "kern": return { ...mapped, type: "mdiKern" };
		case "blank": return { ...mapped, type: "mdiBlank" };
		case "pagebreak": {
			if (mapped.variant === null) delete mapped.variant;
			return { ...mapped, type: "mdiPagebreak" };
		}
		case "paragraph": {
			const data: Record<string, unknown> = {};
			if (typeof mapped.indent === "number") data.mdiIndent = mapped.indent;
			if (typeof mapped.bottom === "number") data.mdiBottom = mapped.bottom;
			delete mapped.indent;
			delete mapped.bottom;
			if (Object.keys(data).length) mapped.data = { ...(mapped.data as Record<string, unknown> | undefined), ...data };
			return mapped;
		}
		default: return mapped;
	}
}
