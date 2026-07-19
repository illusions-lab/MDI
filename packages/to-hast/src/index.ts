import { toHast } from "mdast-util-to-hast";
import type { Handler, State } from "mdast-util-to-hast";
import type {} from "mdast-util-mdi";
import type { Element, Root as HastRoot } from "hast";
import type { Root } from "mdast";
import type { MdiFrontmatter } from "@illusions-lab/mdi-remark";
import { MDI_STYLESHEET } from "./stylesheet.js";

export const MDI_SPEC_VERSION = "2.0";
export { MDI_STYLESHEET };

export interface MdiToHastResult {
	hast: HastRoot;
	frontmatter: MdiFrontmatter | undefined;
}

export function mdiToHast(tree: Root): MdiToHastResult {
	return {
		hast: toHast(tree, {
			allowDangerousHtml: false,
			// Footnotes retain mdast-util-to-hast's default structure and classes.
			clobberPrefix: "",
			handlers: {
				mdiRuby,
				mdiTcy,
				mdiBreak,
				mdiBlank,
				mdiEm,
				mdiNoBreak: phrasing("mdi-nobr"),
				mdiWarichu: phrasing("mdi-warichu"),
				mdiKern,
				mdiPagebreak,
				paragraph,
			},
		}) as HastRoot,
		frontmatter: tree.data?.frontmatter,
	};
}

function element(
	state: State,
	node: Parameters<Handler>[1],
	tagName: string,
	properties: Element["properties"],
	children: Element["children"],
): Element {
	const result: Element = { type: "element", tagName, properties, children };
	state.patch(node, result);
	return state.applyData(node, result) as Element;
}

function phrasing(className: string): Handler {
	return (state, node) =>
		element(state, node, "span", { className: [className] }, state.all(node));
}

const mdiRuby: Handler = (state, node) => {
	const children: Element["children"] = [];
	if (Array.isArray(node.ruby)) {
		for (const [index, base] of graphemes(node.base).entries()) {
			children.push({ type: "text", value: base }, ...ruby(node.ruby[index]));
		}
	} else {
		children.push({ type: "text", value: node.base }, ...ruby(node.ruby));
	}
	return element(state, node, "ruby", { className: ["mdi-ruby"] }, children);
};

function graphemes(value: string): string[] {
	const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
	return Array.from(segmenter.segment(value), (entry) => entry.segment);
}

function ruby(reading: string): Element["children"] {
	return [
		{ type: "element", tagName: "rp", properties: {}, children: [{ type: "text", value: "（" }] },
		{ type: "element", tagName: "rt", properties: {}, children: [{ type: "text", value: reading }] },
		{ type: "element", tagName: "rp", properties: {}, children: [{ type: "text", value: "）" }] },
	];
}

const mdiTcy: Handler = (state, node) =>
	element(state, node, "span", { className: ["mdi-tcy"] }, [
		{ type: "text", value: node.value },
	]);

const mdiBreak: Handler = (state, node) =>
	element(state, node, "br", { className: ["mdi-break"] }, []);

const mdiBlank: Handler = (state, node) =>
	element(state, node, "p", { className: ["mdi-blank"] }, []);

const mdiEm: Handler = (state, node) =>
	element(
		state,
		node,
		"span",
		{ className: ["mdi-em"], style: `--mdi-em:"${cssStringEscape(node.mark)}";` },
		state.all(node),
	);

export function cssStringEscape(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

const mdiKern: Handler = (state, node) =>
	element(
		state,
		node,
		"span",
		{ className: ["mdi-kern"], style: `--mdi-kern:${node.amount};` },
		state.all(node),
	);

const mdiPagebreak: Handler = (state, node) =>
	element(
		state,
		node,
		"div",
		{
			className: ["mdi-pagebreak", ...(node.variant ? [`mdi-pagebreak-${node.variant}`] : [])],
			role: "presentation",
		},
		[],
	);

const paragraph: Handler = (state, node) => {
	const properties: Element["properties"] = {};
	if (node.data?.mdiIndent !== undefined) {
		properties.className = ["mdi-indent"];
		properties.style = `--mdi-indent:${node.data.mdiIndent};`;
	} else if (node.data?.mdiBottom !== undefined) {
		properties.className = ["mdi-bottom"];
		if (node.data.mdiBottom > 0) properties.style = `--mdi-shift:${node.data.mdiBottom};`;
	}
	return element(state, node, "p", properties, state.all(node));
};
