import { layoutWarichuJson } from "@illusions-lab/mdi-core";
import { toHast } from "mdast-util-to-hast";
import type { Handler, State } from "mdast-util-to-hast";
import type {} from "mdast-util-mdi";
import type { Element, Root as HastRoot } from "hast";
import type { Root } from "mdast";
/** Front matter values consumed by publication renderers. */
export interface MdiFrontmatter {
	mdi: string;
	title?: string;
	author?: string;
	lang: string;
	date?: string;
	writingMode: "horizontal" | "vertical";
	pageProgression: "ltr" | "rtl";
}

declare module "mdast" {
	interface RootData {
		frontmatter?: MdiFrontmatter;
	}
}
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
			handlers: mdiHandlers,
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

// Shape conversion only: all splitting decisions remain in Rust.
function warichuIr(node: Record<string, any>): Record<string, any> {
 const types:Record<string,string>={mdiRuby:'ruby',mdiTcy:'tcy',mdiBreak:'break',mdiEm:'em',mdiNoBreak:'noBreak',mdiWarichu:'warichu',mdiKern:'kern'};
 const out:Record<string,any>={...node,type:types[node.type] ?? node.type};
 if(node.children) out.children=node.children.map(warichuIr);
 if(node.type==='mdiRuby') out.ruby={kind:Array.isArray(node.ruby)?'perCharacter':'group',value:node.ruby};
 return out;
}
function warichuMdast(node: Record<string, any>): Record<string, any> {
 const types:Record<string,string>={ruby:'mdiRuby',tcy:'mdiTcy',break:'mdiBreak',em:'mdiEm',noBreak:'mdiNoBreak',warichu:'mdiWarichu',kern:'mdiKern'};
 const out:Record<string,any>={...node,type:types[node.type] ?? node.type};
 if(node.children) out.children=node.children.map(warichuMdast);
 if(node.type==='ruby') out.ruby=node.ruby.value;
 return out;
}
const mdiWarichu:Handler=(state,node)=>{
 const children=node.children.map(warichuIr);
 const fragments=JSON.parse(layoutWarichuJson(JSON.stringify(children),40)) as {lines:Record<string,any>[][];overflow:boolean;hardBreakAfter:boolean}[];
 return element(state,node,'span',{className:['mdi-warichu'],style:'font-size:.5em;line-height:1',dataMdiWarichuSource:JSON.stringify(children)},fragments.flatMap(fragment=>[{
  type:'element',tagName:'span',properties:{className:['mdi-warichu-fragment'],style:'display:inline-flex;flex-direction:column;vertical-align:middle;text-align:start',...(fragment.overflow?{dataMdiOverflow:'true'}:{})},children:fragment.lines.map(line=>({
   type:'element',tagName:'span',properties:{className:['mdi-warichu-line'],style:'display:block;white-space:nowrap;min-block-size:1em'},children:state.all({...node,children:line.map(warichuMdast)})
  }))
 },...(fragment.hardBreakAfter?[{type:'element' as const,tagName:'br',properties:{},children:[]}]:[])]));
};

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

/**
 * The mdast→hast handler table used by `mdiToHast`, exported so existing
 * `remark-rehype` / `mdast-util-to-hast` pipelines (e.g. Astro's
 * `markdown.remarkRehype.handlers`) can render MDI nodes without adopting
 * `mdiToHast` itself. Includes a `paragraph` override that applies
 * block-alignment data (`[[indent:N]]` / `[[bottom]]`) as classes.
 */
export const mdiHandlers: Record<string, Handler> = {
	mdiRuby,
	mdiTcy,
	mdiBreak,
	mdiBlank,
	mdiEm,
	mdiNoBreak: phrasing("mdi-nobr"),
	mdiWarichu,
	mdiKern,
	mdiPagebreak,
	paragraph,
};
