import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdi from "@illusions-lab/mdi-remark";
import type { Root } from "mdast";
import { mdiToHtml } from "./index.js";

function parse(source: string): Root {
	const processor = unified().use(remarkParse).use(remarkMdi);
	return processor.runSync(processor.parse(source)) as Root;
}
describe("mdiToHtml", () => it("wraps rendered MDI in a vertical HTML document", () => {
	const html = mdiToHtml(parse("---\ntitle: 雪女\nlang: ja\nwriting-mode: vertical\n---\n{東京|とうきょう} ^12^"));
	expect(html).toContain('<html lang="ja" style="writing-mode: vertical-rl;">');
	expect(html).toContain("<title>雪女</title>");
	expect(html).toContain("<style>");
	expect(html).toContain("document.addEventListener('wheel'");
	expect(html).toContain("window.scrollBy({left:-delta,behavior:'auto'})");
	expect(html).toContain('<ruby class="mdi-ruby">東京<rp>（</rp><rt>とうきょう</rt>');
}));

describe("mdiToHtml edge cases", () => {
	it.each([
		null,
		{ type: "paragraph", children: [] },
		{ type: "root", children: null },
	])("rejects an invalid adapter tree %#", (tree) => {
		expect(() => mdiToHtml(tree as never)).toThrow("tree must be an mdast root");
	});

	it("uses horizontal Japanese defaults without a title when front matter is absent", () => {
		const html = mdiToHtml(parse("plain text"));
		expect(html).toContain('<html lang="ja">');
		expect(html).not.toContain("<title>");
		expect(html).not.toContain("writing-mode:");
	});

	it("keeps an explicit non-vertical front matter document horizontal", () => {
		const html = mdiToHtml(parse("---\ntitle: Horizontal\nlang: en\nwriting-mode: horizontal\n---\ntext"));
		expect(html).toContain('<html lang="en">');
		expect(html).toContain("<title>Horizontal</title>");
		expect(html).not.toContain("writing-mode:");
		expect(html).not.toContain("document.addEventListener('wheel'");
	});

	it("defaults the language when only other front matter fields are present", () => {
		const tree = parse("text");
		// Consumers may construct the MDAST directly rather than using remark;
		// retain the documented Japanese fallback for that valid shape too.
		tree.data = { frontmatter: { title: "Untagged" } } as unknown as typeof tree.data;
		const html = mdiToHtml(tree);
		expect(html).toContain('<html lang="ja">');
		expect(html).toContain("<title>Untagged</title>");
	});

	it("escapes HTML-special title and language values", () => {
		const html = mdiToHtml(parse('---\ntitle: "A < B & \\"quoted\\""\nlang: "ja<&\\""\n---\ntext'));
		expect(html).toContain('<html lang="ja&lt;&amp;&quot;">');
		expect(html).toContain("<title>A &lt; B &amp; &quot;quoted&quot;</title>");
	});

	it("embeds the Rust-owned stylesheet", () => {
		// Ruby and tate-chu-yoko have no dedicated CSS block in SYNTAX.md
		// (<ruby>/<rt>/<rp> are styled natively; text-combine-upright is
		// mentioned only in prose) - .mdi-em/.mdi-kern are constructs that do.
		const html = mdiToHtml(parse("text"));
		expect(html).toContain(".mdi-em");
		expect(html).toContain(".mdi-kern");
		expect(html).toContain("letter-spacing");
	});
});
