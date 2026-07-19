import type { Handle, Options as ToMarkdownExtension } from "mdast-util-to-markdown";
import type { Paragraph } from "mdast";
import { escapeMdi } from "./escape.js";
import type { MdiEm, MdiKern, MdiNoBreak, MdiPagebreak, MdiRuby, MdiTcy, MdiWarichu } from "./types.js";

export function mdiToMarkdown(): ToMarkdownExtension {
	return {
		handlers: {
			mdiRuby,
			mdiTcy,
			mdiBreak,
			mdiBlank,
			mdiEm,
			mdiNoBreak,
			mdiWarichu,
			mdiKern,
			mdiPagebreak,
			paragraph,
		},
	};
}

const mdiRuby: Handle = (node) => {
	const ruby = node as MdiRuby;
	const text = Array.isArray(ruby.ruby) ? ruby.ruby.map(escapeMdi).join(".") : escapeMdi(ruby.ruby);
	return `{${escapeMdi(ruby.base)}|${text}}`;
};

const mdiTcy: Handle = (node) => `^${(node as MdiTcy).value}^`;

const mdiBreak: Handle = () => "[[br]]";

const mdiBlank: Handle = () => "\\";

const mdiEm: Handle = (node, _parent, state, info) => {
	const em = node as MdiEm;
	const content = state.containerPhrasing(em, info);
	return em.mark === "﹅" ? `[[em:${content}]]` : `[[em:${escapeMdi(em.mark)}:${content}]]`;
};

const mdiNoBreak: Handle = (node, _parent, state, info) => `[[no-break:${state.containerPhrasing(node as MdiNoBreak, info)}]]`;

const mdiWarichu: Handle = (node, _parent, state, info) => `[[warichu:${state.containerPhrasing(node as MdiWarichu, info)}]]`;

const mdiKern: Handle = (node, _parent, state, info) => {
	const kern = node as MdiKern;
	return `[[kern:${kern.amount}:${state.containerPhrasing(kern, info)}]]`;
};

const mdiPagebreak: Handle = (node) => {
	const pagebreak = node as MdiPagebreak;
	return pagebreak.variant ? `[[pagebreak:${pagebreak.variant}]]` : "[[pagebreak]]";
};

const paragraph: Handle = (node, _parent, state, info) => {
	const paragraph = node as Paragraph;
	const exit = state.enter("paragraph");
	const subexit = state.enter("phrasing");
	const value = state.containerPhrasing(paragraph, info);
	subexit();
	exit();

	if (paragraph.data?.mdiIndent !== undefined) return `[[indent:${paragraph.data.mdiIndent}]]\n${value}`;
	if (paragraph.data?.mdiBottom !== undefined) {
		return `${paragraph.data.mdiBottom === 0 ? "[[bottom]]" : `[[bottom:${paragraph.data.mdiBottom}]]`}\n${value}`;
	}

	return value;
};
