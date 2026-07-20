import { describe, expect, it } from "vitest";
import { toMarkdown } from "mdast-util-to-markdown";
import type { Root, RootContent } from "mdast";
import { mdiToMarkdown } from "./to-markdown.js";

function document(children: RootContent[]): Root {
	return { type: "root", children };
}

function serialize(tree: Root): string {
	return toMarkdown(tree, { extensions: [mdiToMarkdown()] });
}

describe("mdiToMarkdown", () => {
	it("serializes every Rust-produced inline MDI node without invoking a JavaScript parser", () => {
		const tree = document([
			{
				type: "paragraph",
				children: [
					{ type: "mdiRuby", base: "東京", ruby: "とうきょう" },
					{ type: "text", value: " " },
					{ type: "mdiRuby", base: "今日", ruby: ["きょ", "う"] },
					{ type: "text", value: " " },
					{ type: "mdiTcy", value: "12" },
					{ type: "text", value: " " },
					{ type: "mdiBreak" },
					{ type: "mdiEm", mark: "﹅", children: [{ type: "text", value: "em" }] },
					{ type: "mdiEm", mark: "●", children: [{ type: "text", value: "mark" }] },
					{ type: "mdiNoBreak", children: [{ type: "text", value: "keep" }] },
					{ type: "mdiWarichu", children: [{ type: "text", value: "note" }] },
					{ type: "mdiKern", amount: "-0.1em", children: [{ type: "text", value: "tight" }] },
				],
			} as RootContent,
		]);

		expect(serialize(tree)).toBe(
			"{東京|とうきょう} {今日|きょ.う} ^12^ [[br]][[em:em]][[em:●:mark]][[no-break:keep]][[warichu:note]][[kern:-0.1em:tight]]\n",
		);
	});

	it("serializes block markers and their paragraph alignment data", () => {
		const tree = document([
			{ type: "mdiBlank" } as RootContent,
			{ type: "mdiPagebreak" } as RootContent,
			{ type: "mdiPagebreak", variant: "right" } as RootContent,
			{ type: "mdiPagebreak", variant: "left" } as RootContent,
			{ type: "paragraph", data: { mdiIndent: 2 }, children: [{ type: "text", value: "indent" }] },
			{ type: "paragraph", data: { mdiBottom: 0 }, children: [{ type: "text", value: "bottom" }] },
			{ type: "paragraph", data: { mdiBottom: 3 }, children: [{ type: "text", value: "shift" }] },
		]);

		expect(serialize(tree)).toBe(
			"\\\n\n[[pagebreak]]\n\n[[pagebreak:right]]\n\n[[pagebreak:left]]\n\n[[indent:2]]\nindent\n\n[[bottom]]\nbottom\n\n[[bottom:3]]\nshift\n",
		);
	});

	it("escapes every MDI delimiter in data supplied by an edited mdast tree", () => {
		const tree = document([
			{
				type: "paragraph",
				children: [{ type: "mdiRuby", base: "{a}", ruby: "r|^[]:《》\\" }],
			} as RootContent,
		]);

		expect(serialize(tree)).toBe("{\\{a\\}|r\\|\\^\\[\\]\\:\\《\\》\\\\}\n");
	});
});
