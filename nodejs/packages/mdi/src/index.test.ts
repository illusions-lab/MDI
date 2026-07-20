import { describe, expect, it } from "vitest";
import { MDI_IR_VERSION, MDI_SPEC_VERSION, parse, renderDocx, renderEpub, renderHtml, renderText, renderTextFormat, serializeMdi } from "./index.js";

function assertValidSpans(node: { span?: { startByte: number; endByte: number }; children?: unknown[] }, source: string): void {
	if (node.span) {
		expect(node.span.startByte).toBeGreaterThanOrEqual(0);
		expect(node.span.startByte).toBeLessThanOrEqual(node.span.endByte);
		expect(node.span.endByte).toBeLessThanOrEqual(Buffer.byteLength(source));
	}
	for (const child of node.children ?? []) {
		assertValidSpans(child as typeof node, source);
	}
}

describe("Rust MDI JavaScript binding", () => {
	it("returns the complete Rust-owned document contract", () => {
		const result = parse("第^12^話");

		expect(result.irVersion).toBe(MDI_IR_VERSION);
		expect(result.syntaxVersion).toBe(MDI_SPEC_VERSION);
		expect(result.capabilities).toEqual({
			mdi: true,
			commonMark: true,
			gfm: true,
			frontMatter: true,
			sourceSpans: true,
		});
		expect(result.diagnostics).toEqual([]);
		expect(result.document.children[0]).toMatchObject({ type: "paragraph", span: { startByte: 0, endByte: 10 } });
	});

	it("exposes nested syntax decisions made by Rust", () => {
		const result = parse("**第^12^話**\n\n| a | b |\n| - | - |\n| 1 | 2 |");
		expect(result.document.children.map((node) => node.type)).toEqual(["paragraph", "table"]);
	});

	it("does not perform JavaScript-side syntax fallback", () => {
		const result = parse("[[kern:wide:text]]");
		expect(result.document.children[0]).toMatchObject({ type: "paragraph" });
	});

	it("rejects non-string input at the host boundary", () => {
		expect(() => parse(null as never)).toThrow("source must be a string");
		expect(() => renderHtml({} as never)).toThrow("source must be a string");
		expect(() => renderEpub(null as never)).toThrow("source must be a string");
		expect(() => renderDocx(null as never)).toThrow("source must be a string");
		expect(() => serializeMdi(null as never)).toThrow("source must be a string");
		expect(() => renderText(null as never)).toThrow("source must be a string");
		expect(() => renderTextFormat("text", "txt", null as never)).toThrow(
			"source and indentPrefix must be strings",
		);
		expect(() => renderTextFormat("text", "invalid" as never)).toThrow("Unsupported text format");
	});

	it("keeps the Rust wire contract valid for adversarial UTF-8 and delimiter input", () => {
		const corpus = [
			"\\{}《《傍点》》\n\n\\[{東京|とう.きょう}",
			"👨‍👩‍👧 [[em:**強調**]] [^n]\n\n[^n]: 注",
			"[[indent:2]]\n{𠮟る|しか.る} [[no-break:^12^]]\n\n[[pagebreak:left]]",
			"```mdi\n{東京|とうきょう}\n```\n\n| a | b |\n| - | - |\n| [[em:x]] | ^12^ |",
		];
		for (const source of corpus) {
			const result = parse(source);
			expect(result.document.span).toEqual({ startByte: 0, endByte: Buffer.byteLength(source) });
			assertValidSpans(result.document, source);
			expect(renderHtml(source)).toContain("<!DOCTYPE html>");
			expect(parse(serializeMdi(source)).irVersion).toBe(MDI_IR_VERSION);
		}
	});

	it("renders source through Rust without a host Markdown parser", () => {
		const html = renderHtml("# 題\n\n{東京|とうきょう} ^12^");
		expect(html).toContain("<h1>題</h1>");
		expect(html).toContain('<ruby class="mdi-ruby">東京');
		expect(html).toContain('<span class="mdi-tcy">12</span>');
	});

	it("normalizes MDI through Rust's serializer", () => {
		expect(serializeMdi("{東京|とう.きょう} ^12^")).toBe("{東京|とう.きょう} ^12^\n");
	});

	it("renders plain text through Rust", () => {
		expect(renderText("{東京|とうきょう} ^12^")).toBe("東京 12\n");
	});

	it("renders platform text formats through Rust", () => {
		expect(renderTextFormat("{東京|とうきょう}", "txt-ruby")).toBe("{東京|とうきょう}");
		expect(renderTextFormat("{東京|とうきょう}", "narou")).toBe("｜東京《とうきょう》");
	});

	it("packages a baseline EPUB through Rust", () => {
		const epub = renderEpub("# Chapter\n\ntext");
		expect([...epub.slice(0, 2)]).toEqual([0x50, 0x4b]);
	});

	it("packages a baseline DOCX through Rust", () => {
		const docx = renderDocx("text");
		expect([...docx.slice(0, 2)]).toEqual([0x50, 0x4b]);
	});
});
