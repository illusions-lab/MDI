import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { MDI_IR_VERSION, MDI_SPEC_VERSION, parse, prepareRender, renderDocx, renderDocxWithDiagnostics, renderDocxWithProfile, renderEpub, renderEpubWithDiagnostics, renderEpubWithProfile, renderHtml, renderHtmlWithDiagnostics, renderText, renderTextFormat, renderTextFormatWithDiagnostics, renderTextWithDiagnostics, serializeMdi, toPublicationMdast } from "./index.js";

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

	it("offers body-only semantic HTML without changing Rust rendering", () => {
		const full = renderHtml("# 題\n\n{東京|とうきょう}");
		const body = renderHtml("# 題\n\n{東京|とうきょう}", { bodyOnly: true });
		expect(full).toContain("<!DOCTYPE html>");
		expect(body).not.toContain("<!DOCTYPE html>");
		expect(body).toContain("<h1>題</h1>");
		expect(body).toContain('<ruby class="mdi-ruby">東京');
		expect(() => renderHtml("text", { bodyOnly: "yes" as never })).toThrow(
			"options.bodyOnly must be a boolean",
		);
	});

	it("keeps diagnostics, source spans, and headings with HTML output", () => {
		const source = "# 第一章\n\n## {東京|とうきょう}";
		const result = renderHtmlWithDiagnostics(source, { bodyOnly: true });
		expect(result.output).toContain("<h1>第一章</h1>");
		expect(result.document.span).toEqual({ startByte: 0, endByte: Buffer.byteLength(source) });
		expect(result.diagnostics).toEqual(parse(source).diagnostics);
		expect(result.headings).toMatchObject([
			{ depth: 1, text: "第一章", span: { startByte: 0 } },
			{ depth: 2, text: "東京" },
		]);
		expect(result.headings[1]!.span).toEqual({
			startByte: Buffer.byteLength("# 第一章\n\n"),
			endByte: Buffer.byteLength(source),
		});
		expect(result.headings[1]!.node.children?.[0]).toMatchObject({ type: "ruby" });
	});

	it("makes parse-first validation explicit for host render workflows", () => {
		const prepared = prepareRender("# before export");
		expect(prepared.document.children[0]).toMatchObject({ type: "heading", depth: 1 });
		expect(prepared.diagnostics).toEqual([]);
	});

	it("keeps diagnostics with text and baseline archive renderer outputs", () => {
		const text = renderTextWithDiagnostics("# chapter\n\ntext");
		expect(text.output).toBe("chapter\ntext\n");
		expect(text.headings).toMatchObject([{ depth: 1, text: "chapter" }]);
		expect(renderTextFormatWithDiagnostics("{東京|とうきょう}", "narou").output).toBe("｜東京《とうきょう》");
		expect([...renderEpubWithDiagnostics("text").output.slice(0, 2)]).toEqual([0x50, 0x4b]);
		expect([...renderDocxWithDiagnostics("text").output.slice(0, 2)]).toEqual([0x50, 0x4b]);
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

	it("publishes a configured EPUB with metadata, cover, chapters, and vertical type", async () => {
		const epub = await renderEpubWithProfile("# First\n\nbody\n\n# Second\n\nmore", {
			profile: {
				layout: { system: "japanese-publisher" },
				metadata: { title: "Configured book", author: "MDI", identifier: "test:configured" },
				typesetting: { writingMode: "vertical", fontFamily: "Noto Serif JP", textIndentEm: 2 },
				epub: { chapterSplitLevel: "h1" },
			},
			cover: { data: new Uint8Array([137, 80, 78, 71]), mediaType: "image/png" },
		});
		const zip = await JSZip.loadAsync(epub);
		const opf = await zip.file("OEBPS/package.opf")!.async("string");
		const css = await zip.file("OEBPS/style.css")!.async("string");

		expect(zip.file("OEBPS/cover.png")).toBeTruthy();
		expect(opf).toContain("<dc:title>Configured book</dc:title>");
		expect(opf).toContain("<dc:creator>MDI</dc:creator>");
		expect(opf).toContain('page-progression-direction="rtl"');
		expect(css).toContain("writing-mode:vertical-rl");
		expect(css).toContain("font-family:Noto Serif JP");
		expect(Object.keys(zip.files).filter((name) => name.startsWith("OEBPS/chapter-"))).toHaveLength(2);
	});

	it("offers configured EPUB through the renderEpub overload", async () => {
		const epub = await renderEpub("# chapter", {
			profile: { layout: { system: "japanese-publisher" } },
			title: "Ergonomic book",
			verticalWriting: true,
			fontFamily: "Noto Serif JP",
			textIndent: 3,
			chapterSplitLevel: "none",
			coverImage: new Uint8Array([137, 80, 78, 71]),
			coverMediaType: "image/png",
		});
		const zip = await JSZip.loadAsync(epub);
		expect(await zip.file("OEBPS/package.opf")!.async("string")).toContain("Ergonomic book");
		expect(await zip.file("OEBPS/style.css")!.async("string")).toContain("text-indent:3em");
		expect(zip.file("OEBPS/cover.png")).toBeTruthy();
	});

	it("maps EPUB typography aliases and retains diagnostics for configured archives", async () => {
		const source = "# Chapter\n\nbody";
		const result = await renderEpubWithDiagnostics(source, {
			title: "Typeset EPUB",
			profile: { layout: { system: "word" } },
		fontSize: 13,
		lineSpacing: 1.6,
		gridMode: "typographic",
			textIndent: 2,
			fullwidthSpaceIndent: true,
		});
		const zip = await JSZip.loadAsync(result.output);
		const css = await zip.file("OEBPS/style.css")!.async("string");
		expect(css).toContain("font-size:13pt");
		expect(css).toContain("line-height:1.6");
		expect(css).toContain("--mdi-fullwidth-space-indent:1");
		expect(css).toContain("text-indent:2em");
		expect(result.document.span.endByte).toBe(Buffer.byteLength(source));
		expect(result.headings).toMatchObject([{ text: "Chapter" }]);
	});

	it("publishes a configured DOCX with vertical layout, geometry, margins, and page numbering", async () => {
		const docx = await renderDocxWithProfile("{東京|とうきょう} ^12^", {
			layout: { system: "japanese-publisher" },
			metadata: { title: "Layout book", author: "MDI" },
			typesetting: { writingMode: "vertical", fontFamily: "Noto Serif JP" },
			pagination: {
				pageSize: "A5",
				margins: { top: 10, bottom: 11, left: 12, right: 13 },
				pageNumbers: { enabled: true, format: "fraction", position: "top-right" },
			},
		});
		const zip = await JSZip.loadAsync(docx);
		const document = await zip.file("word/document.xml")!.async("string");
		const header = await zip.file("word/header1.xml")!.async("string");

		expect(document).toContain('w:textDirection w:val="tbRl"');
		// A5 portrait remains physically portrait; Word applies vertical text direction.
		expect(document).toContain('w:w="8391"');
		expect(document).toContain('w:h="11906"');
		expect(document).toContain('w:top="567" w:right="737" w:bottom="624" w:left="680"');
		expect(document).toContain("<w:ruby ");
		expect(document).toContain("<w:eastAsianLayout");
		expect(header).toContain("PAGE");
		expect(header).toContain("NUMPAGES");
	});

	it("normalizes ergonomic DOCX layout options without mutating the caller profile", async () => {
		const options = {
			title: "Ergonomic DOCX",
			layout: { system: "word" as const },
			verticalWriting: true,
			fontFamily: "Noto Serif JP",
		fontSize: 12,
		lineSpacing: 1.5,
		gridMode: "typographic" as const,
			textIndent: 2,
			pageSize: "A5" as const,
			margins: { top: 10, bottom: 10, left: 11, right: 11 },
			showPageNumbers: true,
			pageNumberPosition: "top-right" as const,
			pageNumberFormat: "fraction" as const,
		};
		const before = structuredClone(options);
		const docx = await renderDocx("body", options);
		const zip = await JSZip.loadAsync(docx);
		const document = await zip.file("word/document.xml")!.async("string");
		expect(options).toEqual(before);
		expect(document).toContain('w:textDirection w:val="tbRl"');
		expect(document).toContain('w:top="567" w:right="624" w:bottom="567" w:left="624"');
		expect(await zip.file("word/header1.xml")!.async("string")).toContain("NUMPAGES");
	});

	it("maps DOCX grid and full-width indentation aliases with diagnostics", async () => {
		const result = await renderDocxWithDiagnostics("body", {
			title: "Grid book",
			layout: { system: "japanese-publisher" },
			charactersPerLine: 32,
			linesPerPage: 28,
			textIndent: 2,
			fullwidthSpaceIndent: true,
		});
		const zip = await JSZip.loadAsync(result.output);
		const document = await zip.file("word/document.xml")!.async("string");
		expect(document).toContain("　　");
		expect(result.diagnostics).toEqual([]);
	});

	it("validates configured-export host inputs", async () => {
		expect(() => renderEpub("text", null as never)).toThrow("options must be an object");
		expect(() => renderDocx("text", [] as never)).toThrow("profile must be an object");
		await expect(renderEpubWithProfile("text", {
			cover: { data: "not-bytes" as never, mediaType: "image/png" },
		})).rejects.toThrow("options.cover.data must be a Uint8Array");
		await expect(renderDocxWithProfile("text", {})).rejects.toThrow("Configured exports require layout.system");
	});

	it("converts the complete Rust IR structurally for publication adapters", () => {
		const tree = toPublicationMdast({
			span: { startByte: 0, endByte: 1 },
			frontmatter: { span: { startByte: 0, endByte: 0 }, raw: "not: [valid", entries: [] },
			children: [
				{ type: "ruby", ruby: { value: "よみ" }, base: "字" },
				{ type: "tcy", value: "12" }, { type: "break" }, { type: "em" },
				{ type: "noBreak" }, { type: "warichu" }, { type: "kern" }, { type: "blank" },
				{ type: "pagebreak", variant: null },
				{ type: "paragraph", indent: 2, bottom: 1 }, { type: "unknown" },
			],
		} as never);
		expect(tree.data?.frontmatter).toMatchObject({ mdi: "2.0", lang: "ja", writingMode: "horizontal" });
		expect(tree.children.map((node) => node.type)).toEqual([
			"yaml", "mdiRuby", "mdiTcy", "mdiBreak", "mdiEm", "mdiNoBreak", "mdiWarichu", "mdiKern", "mdiBlank", "mdiPagebreak", "paragraph", "unknown",
		]);
		expect((tree.children[10] as { data?: unknown }).data).toEqual({ mdiIndent: 2, mdiBottom: 1 });
		expect(tree.children[9]).not.toHaveProperty("variant");
	});

	it("preserves an explicit frontmatter page progression for publication adapters", () => {
		const tree = toPublicationMdast({
			span: { startByte: 0, endByte: 0 },
			frontmatter: {
				span: { startByte: 0, endByte: 25 },
				raw: "page-progression: ltr",
				entries: [],
			},
			children: [],
		} as never);
		expect(tree.data?.frontmatter).toMatchObject({ pageProgression: "ltr" });
	});

	it("rejects malformed cover shorthands before loading publication adapters", () => {
		expect(() => renderEpub("text", { cover: { data: new Uint8Array(), mediaType: "image/gif" as never } })).toThrow("options.cover.mediaType");
		expect(() => renderEpub("text", { coverImage: "not-bytes" as never })).toThrow("options.coverImage");
		expect(() => renderEpub("text", { coverMediaType: "image/gif" as never })).toThrow("options.coverMediaType");
	});
});
