import { describe, expect, it } from "vitest";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mdi } from "micromark-extension-mdi";
import type { Paragraph, Root, Text } from "mdast";
import { mdiFromMarkdown } from "./from-markdown.js";
import type { MdiBlank, MdiEm, MdiKern, MdiNoBreak, MdiPagebreak, MdiRuby, MdiTcy, MdiWarichu } from "./types.js";

function parse(value: string): Root {
	return fromMarkdown(value, {
		extensions: [mdi()],
		mdastExtensions: [mdiFromMarkdown()],
	});
}

function firstParagraphChildren(tree: Root) {
	const paragraph = tree.children[0] as Paragraph;
	expect(paragraph.type).toBe("paragraph");
	return paragraph.children;
}

// Nodes built via `this.enter()`/`this.exit()` carry `position` (unlike the
// hand-rolled text nodes some MDI handlers assign directly) — strip it so
// structural assertions don't have to spell out every position too.
function withoutPosition(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(withoutPosition);
	}
	if (value && typeof value === "object") {
		const { position: _position, ...rest } = value as Record<string, unknown>;
		for (const key of Object.keys(rest)) {
			rest[key] = withoutPosition(rest[key]);
		}
		return rest;
	}
	return value;
}

describe("mdiRuby", () => {
	it("parses group ruby", () => {
		const children = firstParagraphChildren(parse("{東京|とうきょう}"));
		expect(children).toHaveLength(1);
		const node = children[0] as MdiRuby;
		expect(node.type).toBe("mdiRuby");
		expect(node.base).toBe("東京");
		expect(node.ruby).toBe("とうきょう");
	});

	it("parses split ruby when segment count matches base grapheme count", () => {
		const children = firstParagraphChildren(parse("{東京|とう.きょう}"));
		const node = children[0] as MdiRuby;
		expect(node.base).toBe("東京");
		expect(node.ruby).toEqual(["とう", "きょう"]);
	});

	it("falls back to group ruby when a split segment is empty", () => {
		// SYNTAX.md §2 Edge Cases' own example.
		const children = firstParagraphChildren(parse("{東京|.きょう}"));
		const node = children[0] as MdiRuby;
		expect(node.base).toBe("東京");
		expect(node.ruby).toBe("きょう");
	});

	it("falls back to group ruby when segment count doesn't match base length", () => {
		const children = firstParagraphChildren(parse("{東京|と.う.きょう}"));
		const node = children[0] as MdiRuby;
		expect(node.ruby).toBe("とうきょう");
	});

	it("unescapes a literal separator inside the base", () => {
		const children = firstParagraphChildren(parse(String.raw`{東\|京|とうきょう}`));
		const node = children[0] as MdiRuby;
		expect(node.base).toBe("東|京");
		expect(node.ruby).toBe("とうきょう");
	});

	it("treats an unclosed ruby as literal text", () => {
		const children = firstParagraphChildren(parse("{東京|とうきょう"));
		expect(children.every((child) => child.type === "text")).toBe(true);
		expect((children[0] as Text).value).toBe("{東京|とうきょう");
	});

	it("treats a brace pair with no separator as literal text", () => {
		const children = firstParagraphChildren(parse("{plain}"));
		expect(children).toHaveLength(1);
		expect(children[0].type).toBe("text");
		expect((children[0] as Text).value).toBe("{plain}");
	});

	it("counts split segments in grapheme clusters, not UTF-16 code units", () => {
		// 𠮟 is a surrogate pair (one grapheme, two UTF-16 code units).
		const children = firstParagraphChildren(parse("{𠮟る|しか.る}"));
		const node = children[0] as MdiRuby;
		expect(node.ruby).toEqual(["しか", "る"]);
	});
});

describe("mdiTcy", () => {
	it("parses tate-chu-yoko within text", () => {
		const children = firstParagraphChildren(parse("第^12^話"));
		expect(children).toHaveLength(3);
		const node = children[1] as MdiTcy;
		expect(node.type).toBe("mdiTcy");
		expect(node.value).toBe("12");
	});

	it("parses tate-chu-yoko at the start of text", () => {
		const children = firstParagraphChildren(parse("^OK^"));
		const node = children[0] as MdiTcy;
		expect(node.type).toBe("mdiTcy");
		expect(node.value).toBe("OK");
	});

	it("treats invalid tate-chu-yoko content as literal text", () => {
		const children = firstParagraphChildren(parse("(^_^)"));
		expect(children).toHaveLength(1);
		expect((children[0] as Text).value).toBe("(^_^)");
	});

	it("treats tate-chu-yoko with more than six characters as literal text", () => {
		const children = firstParagraphChildren(parse("^1234567^"));
		expect(children).toHaveLength(1);
		expect((children[0] as Text).value).toBe("^1234567^");
	});

	it("treats empty tate-chu-yoko as literal text", () => {
		const children = firstParagraphChildren(parse("^^"));
		expect(children).toHaveLength(1);
		expect((children[0] as Text).value).toBe("^^");
	});

	it("treats tate-chu-yoko unclosed at a line ending as literal text", () => {
		const children = firstParagraphChildren(parse("^12\nnext"));
		expect((children[0] as Text).value).toBe("^12\nnext");
	});
});

describe("mdiBotenAlias", () => {
	it("parses the boten alias", () => {
		const children = firstParagraphChildren(parse("彼は《《それ》》を見た。"));
		expect(children).toHaveLength(3);
		const node = children[1] as MdiEm;
		expect(node.type).toBe("mdiEm");
		expect(node.mark).toBe("﹅");
		expect(node.children).toEqual([{ type: "text", value: "それ" }]);
	});

	it("treats title quotes inside the boten alias as literal text", () => {
		const children = firstParagraphChildren(parse("《《雪》考》"));
		expect(children).toHaveLength(1);
		expect((children[0] as Text).value).toBe("《《雪》考》");
	});

	it("treats a bare opening title quote inside the boten alias as literal text", () => {
		const children = firstParagraphChildren(parse("《《雪《考》》"));
		expect(children).toHaveLength(1);
		expect((children[0] as Text).value).toBe("《《雪《考》》");
	});

	it("leaves a single opening title quote as literal text", () => {
		const children = firstParagraphChildren(parse("《それ》"));
		expect(children).toHaveLength(1);
		expect((children[0] as Text).value).toBe("《それ》");
	});

	it("treats an unclosed boten alias as literal text", () => {
		const children = firstParagraphChildren(parse("《《それ"));
		expect(children).toHaveLength(1);
		expect((children[0] as Text).value).toBe("《《それ");
	});

	it("unescapes title quotes inside the boten alias", () => {
		const children = firstParagraphChildren(parse(String.raw`《《a\《b》》`));
		expect((children[0] as MdiEm).children).toEqual([{ type: "text", value: "a《b" }]);
	});

	it("keeps alias content as plain text", () => {
		const children = firstParagraphChildren(parse("《《^12^》》"));
		expect((children[0] as MdiEm).children).toEqual([{ type: "text", value: "^12^" }]);
	});
});

describe("mdiBracketMacro", () => {
	it("parses the void br macro", () => {
		const node = firstParagraphChildren(parse("a[[br]]b"))[1];
		expect(withoutPosition(node)).toEqual({ type: "mdiBreak" });
	});

	it("parses no-break", () => {
		const node = firstParagraphChildren(parse("[[no-break:keep together]]"))[0] as MdiNoBreak;
		expect(withoutPosition(node)).toEqual({ type: "mdiNoBreak", children: [{ type: "text", value: "keep together" }] });
	});

	it("parses em with its default mark", () => {
		const node = firstParagraphChildren(parse("[[em:dot]]"))[0] as MdiEm;
		expect(withoutPosition(node)).toEqual({ type: "mdiEm", mark: "﹅", children: [{ type: "text", value: "dot" }] });
	});

	it("disambiguates an em mark parameter", () => {
		const marked = firstParagraphChildren(parse("[[em:●:それ]]"))[0] as MdiEm;
		expect(withoutPosition(marked)).toEqual({ type: "mdiEm", mark: "●", children: [{ type: "text", value: "それ" }] });
		const unmarked = firstParagraphChildren(parse("[[em:ab:cd]]"))[0] as MdiEm;
		expect(withoutPosition(unmarked)).toEqual({ type: "mdiEm", mark: "﹅", children: [{ type: "text", value: "ab:cd" }] });
	});

	it("parses warichu", () => {
		const node = firstParagraphChildren(parse("[[warichu:small note]]"))[0] as MdiWarichu;
		expect(withoutPosition(node)).toEqual({ type: "mdiWarichu", children: [{ type: "text", value: "small note" }] });
	});

	it("parses kern", () => {
		const node = firstParagraphChildren(parse("[[kern:-0.1em:tight]]"))[0] as MdiKern;
		expect(withoutPosition(node)).toEqual({ type: "mdiKern", amount: "-0.1em", children: [{ type: "text", value: "tight" }] });
	});

	it("keeps invalid macros literal", () => {
		for (const value of ["[[kern:bad:text]]", "[[br:x]]", "[[no-break:]]", "[[em:foo"]) {
			const children = firstParagraphChildren(parse(value));
			expect(children).toHaveLength(1);
			expect(withoutPosition(children[0])).toEqual({ type: "text", value });
		}
	});

	it("nests ruby and bracket macros", () => {
		const ruby = firstParagraphChildren(parse("[[em:{東京|とうきょう}]]"))[0] as MdiEm;
		expect(withoutPosition(ruby.children)).toEqual([{ type: "mdiRuby", base: "東京", ruby: "とうきょう" }]);
		const em = firstParagraphChildren(parse("[[em:foo[[no-break:bar]]baz]]"))[0] as MdiEm;
		expect(withoutPosition(em.children)).toEqual([
			{ type: "text", value: "foo" },
			{ type: "mdiNoBreak", children: [{ type: "text", value: "bar" }] },
			{ type: "text", value: "baz" },
		]);
	});

	it("does not close on an escaped bracket", () => {
		const node = firstParagraphChildren(parse(String.raw`[[em:foo\]bar]]`))[0] as MdiEm;
		expect(withoutPosition(node.children)).toEqual([{ type: "text", value: "foo]bar" }]);
	});
});

describe("mdiBlank", () => {
	it.each(["\\", "\\  ", "<br>", "<br />", "[[blank]]"])("parses %s as a blank paragraph", (value) => {
		const tree = parse(value);
		expect(tree.children).toHaveLength(1);
		expect(withoutPosition(tree.children[0] as MdiBlank)).toEqual({ type: "mdiBlank" });
	});

	it("keeps one node for every consecutive blank marker", () => {
		const tree = parse("\\\n\\\n\\");
		expect(tree.children.map((node) => node.type)).toEqual(["mdiBlank", "mdiBlank", "mdiBlank"]);
	});

	it("interrupts paragraphs", () => {
		const tree = parse("春は曙。\n\\\n夏は夜。");
		expect(withoutPosition(tree)).toEqual({
			type: "root",
			children: [
				{ type: "paragraph", children: [{ type: "text", value: "春は曙。" }] },
				{ type: "mdiBlank" },
				{ type: "paragraph", children: [{ type: "text", value: "夏は夜。" }] },
			],
		});
	});

	it.each(["\\ hello", "hello\\"])("leaves non-standalone markers as text", (value) => {
		const children = firstParagraphChildren(parse(value));
		expect((children[0] as Text).value).toBe(value);
	});
});

describe("mdiBlockMacro", () => {
	it("parses a pagebreak with an omitted variant", () => {
		const tree = parse("before\n\n[[pagebreak]]\n\nafter");
		expect(withoutPosition(tree.children[1] as MdiPagebreak)).toEqual({ type: "mdiPagebreak" });
	});

	it("parses pagebreak variants", () => {
		const tree = parse("[[pagebreak:right]]");
		expect(withoutPosition(tree.children[0] as MdiPagebreak)).toEqual({ type: "mdiPagebreak", variant: "right" });
	});

	it("applies indent to the following paragraph", () => {
		const tree = parse("[[indent:2]]\nparagraph");
		expect(tree.children).toHaveLength(1);
		expect((tree.children[0] as Paragraph).data?.mdiIndent).toBe(2);
	});

	it.each([
		["[[bottom]]", 0],
		["[[bottom:2]]", 2],
	])("applies %s to the following paragraph", (macro, expected) => {
		const tree = parse(`${macro}\nparagraph`);
		expect((tree.children[0] as Paragraph).data?.mdiBottom).toBe(expected);
	});

	it("keeps an invalid indent literal", () => {
		const tree = parse("[[indent:0]]\nparagraph");
		expect(tree.children).toHaveLength(2);
		expect((tree.children[0] as Paragraph).children).toEqual([{ type: "text", value: "[[indent:0]]" }]);
		expect((tree.children[1] as Paragraph).data?.mdiIndent).toBeUndefined();
	});

	it("keeps stacked block macros literal", () => {
		const tree = parse("[[indent:2]]\n[[bottom]]\nparagraph");
		expect(tree.children).toHaveLength(3);
		expect((tree.children[0] as Paragraph).children).toEqual([{ type: "text", value: "[[indent:2]]" }]);
		expect((tree.children[1] as Paragraph).children).toEqual([{ type: "text", value: "[[bottom]]" }]);
		expect((tree.children[2] as Paragraph).data).toBeUndefined();
	});

	it("keeps a trailing block macro literal", () => {
		const tree = parse("[[indent:2]]");
		expect((tree.children[0] as Paragraph).children).toEqual([{ type: "text", value: "[[indent:2]]" }]);
	});
});
