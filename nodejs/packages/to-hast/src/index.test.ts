import { toHtml } from "hast-util-to-html";
import { createRequire } from "node:module";
import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { cssStringEscape, MDI_STYLESHEET, mdiToHast } from "./index.js";

const require = createRequire(import.meta.url);
const { parse: parseMdi, toPublicationMdast } = require("../../mdi/dist/index.cjs") as {
	parse(source: string): { document: unknown };
	toPublicationMdast(document: unknown): Root;
};

function html(source: string): string {
	const tree = toPublicationMdast(parseMdi(source).document);
	return toHtml(mdiToHast(tree).hast);
}

describe("mdiToHast", () => {
	it("returns frontmatter separately from content", () => {
		const tree = toPublicationMdast(parseMdi("---\ntitle: 雪女\n---\n本文").document);
		const result = mdiToHast(tree);

		expect(result.frontmatter?.title).toBe("雪女");
		expect(toHtml(result.hast)).toBe("<p>本文</p>");
	});

	it("renders group and split ruby", () => {
		expect(html("{東京|とうきょう}")).toBe(
			'<p><ruby class="mdi-ruby">東京<rp>（</rp><rt>とうきょう</rt><rp>）</rp></ruby></p>',
		);
		expect(html("{東京|とう.きょう}")).toBe(
			'<p><ruby class="mdi-ruby">東<rp>（</rp><rt>とう</rt><rp>）</rp>京<rp>（</rp><rt>きょう</rt><rp>）</rp></ruby></p>',
		);
	});

	it("renders tcy and explicit breaks", () => {
		expect(html("^12^")).toBe('<p><span class="mdi-tcy">12</span></p>');
		expect(MDI_STYLESHEET).toContain(".mdi-tcy {\n  text-combine-upright: all;");
		expect(html("[[br]]")).toBe('<p><br class="mdi-break"></p>');
	});

	it("renders blank paragraphs", () => {
		expect(html("\\")).toBe('<p class="mdi-blank"></p>');
	});

	it("renders emphasis, no-break, warichu, and kern", () => {
		expect(html("[[em:それ]]")).toBe(
			'<p><span class="mdi-em" style="--mdi-em:&#x22;﹅&#x22;;">それ</span></p>',
		);
		expect(html("[[no-break:東京都新宿区]]")).toBe(
			'<p><span class="mdi-nobr">東京都新宿区</span></p>',
		);
		expect(html("[[warichu:六曜の一つで吉日とされる]]").match(/class="mdi-warichu-line"/g)).toHaveLength(2);
		expect(html("[[kern:-0.1em:確実]]")).toBe(
			'<p><span class="mdi-kern" style="--mdi-kern:-0.1em;">確実</span></p>',
		);
	});

	it("escapes emphasis marks for CSS strings before HTML serialization", () => {
		expect(cssStringEscape('"\\')).toBe('\\"\\\\');
		expect(html('[[em:":text]]')).toBe(
			'<p><span class="mdi-em" style="--mdi-em:&#x22;\\&#x22;&#x22;;">text</span></p>',
		);
		const tree: Root = {
			type: "root",
			children: [
				{
					type: "paragraph",
					children: [{ type: "mdiEm", mark: "\\", children: [{ type: "text", value: "text" }] }],
				},
			],
		};
		expect(toHtml(mdiToHast(tree).hast)).toBe(
			'<p><span class="mdi-em" style="--mdi-em:&#x22;\\\\&#x22;;">text</span></p>',
		);
	});

	it("renders pagebreak variants", () => {
		expect(html("[[pagebreak]]")).toBe(
			'<div class="mdi-pagebreak" role="presentation"></div>',
		);
		expect(html("[[pagebreak:right]]")).toBe(
			'<div class="mdi-pagebreak mdi-pagebreak-right" role="presentation"></div>',
		);
		expect(html("[[pagebreak:left]]")).toBe(
			'<div class="mdi-pagebreak mdi-pagebreak-left" role="presentation"></div>',
		);
	});

	it("renders GFM footnotes with a reference and definition", () => {
		const output = html("A note[^1].\n\n[^1]: note text");

		expect(output).toContain("footnote-ref");
		expect(output).toContain("footnote-backref");
		expect(output).toContain("note text");
	});

	it("passes ordinary Markdown and GFM nodes through alongside MDI", () => {
		const output = html(`# Heading\n\n- [x] item {東京|とうきょう}\n\n| A | B |\n| - | - |\n| [link](https://example.com) | ![alt](image.png) |\n\n\`\`\`ts\nconst value = ^12^;\n\`\`\``);

		expect(output).toContain("<h1>Heading</h1>");
		expect(output).toContain('<input type="checkbox" checked disabled>');
		expect(output).toContain('<ruby class="mdi-ruby">東京');
		expect(output).toContain("<table>");
		expect(output).toContain('<a href="https://example.com">link</a>');
		expect(output).toContain('<img src="image.png" alt="alt">');
		expect(output).toContain("const value = ^12^;");
	});

	it("nests macros and retains GFM inline children in aligned paragraphs", () => {
		const nested = html("[[em:[[no-break:[[warichu:{東京|とうきょう}]]]]]]");
		expect(nested).toContain('<span class="mdi-nobr"><span class="mdi-warichu"');
		expect(nested).toContain('<ruby class="mdi-ruby">東京');
		expect(nested.match(/class="mdi-warichu-line"/g)).toHaveLength(2);
		expect(html("[[indent:2]]\n[link](https://example.com) and ~~old~~ {東京|とうきょう}")).toBe(
			'<p class="mdi-indent" style="--mdi-indent:2;"><a href="https://example.com">link</a> and <del>old</del> <ruby class="mdi-ruby">東京<rp>（</rp><rt>とうきょう</rt><rp>）</rp></ruby></p>',
		);
	});

	it("renders paragraph alignment without changing plain paragraphs", () => {
		expect(html("[[indent:2]]\n我輩は猫である。名前はまだ無い。")).toBe(
			'<p class="mdi-indent" style="--mdi-indent:2;">我輩は猫である。名前はまだ無い。</p>',
		);
		expect(html("[[bottom]]\n著者識")).toBe('<p class="mdi-bottom">著者識</p>');
		expect(html("[[bottom:2]]\n令和七年七月")).toBe(
			'<p class="mdi-bottom" style="--mdi-shift:2;">令和七年七月</p>',
		);
		expect(html("通常の段落")).toBe("<p>通常の段落</p>");
	});
});

it('renders automatic warichu with two lines instead of a single small span', () => {
 const tree = {type:'root',children:[{type:'paragraph',children:[{type:'mdiWarichu',children:[{type:'text',value:'一二三四五六'}]}]}]} as Root;
 const html = toHtml(mdiToHast(tree).hast);
 expect(html.match(/class="mdi-warichu-line"/g)).toHaveLength(2);
 expect(html).toContain('data-mdi-warichu-source');
});

it('preserves atomic overflow, repeated authored breaks and formatted ruby within notes', () => {
 const source = `[[warichu:[[no-break:${'甲'.repeat(50)}]][[br]][[br]]{東京|とう|きょう} **本文** ^12^]]`;
 const output=html(source);
 expect(output).toContain('data-mdi-overflow="true"');
 expect(output.match(/<br>/g)).toHaveLength(2);
 expect(output).toContain('<strong>');
 expect(output).toContain('<ruby');
 expect(output).toContain('mdi-tcy');
});
