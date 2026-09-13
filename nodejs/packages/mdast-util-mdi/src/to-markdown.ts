import { gfmToMarkdown } from "mdast-util-gfm";
import { defaultHandlers } from "mdast-util-to-markdown";
import type { Handle, Options as ToMarkdownExtension } from "mdast-util-to-markdown";
import type { Paragraph } from "mdast";
import { escapeMdi } from "./escape.js";
import type { MdiComment, MdiEm, MdiKern, MdiNoBreak, MdiPagebreak, MdiRuby, MdiTcy, MdiWarichu } from "./types.js";

const gfmHandlers = Object.assign({}, ...gfmToMarkdown().extensions!.map((extension) => extension.handlers)) as Record<string, Handle>;

export function mdiToMarkdown(): ToMarkdownExtension {
	return {
		handlers: {
			mdiComment,
			blockquote: preserveCommentPayloads(defaultHandlers.blockquote),
			list: preserveCommentPayloads(defaultHandlers.list),
			footnoteDefinition: preserveCommentPayloads(gfmHandlers.footnoteDefinition),
			table: preserveCommentPayloads(gfmHandlers.table),
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

const mdiComment: Handle = (node) => `<!--${(node as MdiComment).value}-->`;

/** Container indentation must never become part of an opaque comment value.
 * Nodes remain the only storage: shielding lasts only for this serializer call.
 */
function preserveCommentPayloads(handler: Handle): Handle {
	return (node, parent, state, info) => {
		const previous = state.handlers.mdiComment;
		// An outer container already shields this subtree, including nesting.
		if (previous !== mdiComment) return handler(node, parent, state, info);
		const payloads: string[] = [];
		let prefix = "\uE000mdiComment";
		const serializedNode = JSON.stringify(node);
		while (serializedNode.includes(prefix)) prefix += "x";
		state.handlers.mdiComment = (comment) => {
			const index = payloads.push(`<!--${(comment as MdiComment).value}-->`) - 1;
			return `${prefix}${index}\uE001`;
		};
		try {
			let result = handler(node, parent, state, info);
			for (let index = 0; index < payloads.length; index += 1) {
				result = result.replace(`${prefix}${index}\uE001`, () => payloads[index]);
			}
			return result;
		} finally {
			state.handlers.mdiComment = previous;
		}
	};
}
