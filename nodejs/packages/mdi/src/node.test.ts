import { describe, expect, it, vi } from "vitest";
import {
	preparePdfExport,
	preparePdfExportWithDiagnostics,
	renderPdfWithChromium,
	renderPdfWithChromiumWithDiagnostics,
	type MdiPdfChromiumAdapter,
} from "./node.js";

vi.mock("@illusions-lab/mdi-to-pdf", () => {
	return {
		renderHtmlToPdf: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]),
	};
});

describe("@illusions-lab/mdi/node PDF boundary", () => {
	it("prepares Rust-owned HTML and preserves front-matter writing mode", () => {
		const request = preparePdfExport(
			"---\nwriting-mode: vertical\n---\n# 題\n\n{東京|とうきょう}",
			{ layout: { system: "japanese-publisher" }, pagination: { pageSize: "A5" } },
		);

		expect(request.sourceWritingMode).toBe("vertical");
		expect(request.profile).toEqual({ layout: { system: "japanese-publisher" }, pagination: { pageSize: "A5" } });
		expect(request.html).toContain("<!DOCTYPE html>");
		expect(request.html).toContain('<ruby class="mdi-ruby">東京');
	});

	it("hands explicit HTML/profile data to an Electron-compatible adapter", async () => {
		const renderHtmlToPdf = vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]));
		const adapter: MdiPdfChromiumAdapter = { renderHtmlToPdf };
		const profile = { layout: { system: "word" as const }, typesetting: { writingMode: "horizontal" as const } };

		await expect(renderPdfWithChromium("text", profile, adapter)).resolves.toEqual(
			new Uint8Array([0x25, 0x50, 0x44, 0x46]),
		);
		expect(renderHtmlToPdf).toHaveBeenCalledWith(
			expect.stringContaining("<!DOCTYPE html>"), profile, undefined,
		);
	});

	it("retains diagnostics, source spans, and headings at the PDF boundary", async () => {
		const profile = { layout: { system: "japanese-publisher" as const }, pagination: { pageSize: "A5" as const } };
		const prepared = preparePdfExportWithDiagnostics("# {東京|とうきょう}\n\ntext", profile);
		expect(prepared.output.profile).toBe(profile);
		expect(prepared.output.sourceWritingMode).toBeUndefined();
		expect(prepared.document.span.startByte).toBe(0);
		expect(prepared.diagnostics).toEqual([]);
		expect(prepared.headings).toMatchObject([{ depth: 1, text: "東京" }]);

		const adapter: MdiPdfChromiumAdapter = {
			renderHtmlToPdf: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]),
		};
		const rendered = await renderPdfWithChromiumWithDiagnostics("# {東京|とうきょう}\n\ntext", profile, adapter);
		expect(rendered.output).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
		expect(rendered.headings[0]?.text).toBe("東京");
	});

	it("handles both supported front-matter spellings and ordinary headings", () => {
		const horizontal = preparePdfExport("---\nwritingMode: horizontal\n---\n# Plain");
		expect(horizontal.sourceWritingMode).toBe("horizontal");
		const diagnostics = preparePdfExportWithDiagnostics("# Plain");
		expect(diagnostics.output.sourceWritingMode).toBeUndefined();
		expect(diagnostics.headings).toMatchObject([{ text: "Plain" }]);
		const verticalDiagnostics = preparePdfExportWithDiagnostics(
			"---\nwriting-mode: vertical\n---\ntext",
		);
		expect(verticalDiagnostics.output.sourceWritingMode).toBe("vertical");
	});

	it("rejects invalid source before loading a browser adapter", () => {
		expect(() => preparePdfExport(null as never)).toThrow("source must be a string");
		expect(() => preparePdfExport("text", { pagination: { pageSize: "A4" } }))
			.toThrow("Configured exports require layout.system");
	});

	it("loads the optional default Chromium adapter only for the Node entry point", async () => {
		await expect(renderPdfWithChromium("text")).resolves.toEqual(
			new Uint8Array([0x25, 0x50, 0x44, 0x46]),
		);
		await expect(renderPdfWithChromiumWithDiagnostics("text")).resolves.toMatchObject({
			output: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
		});
	});

	it("embeds assets in the diagnostics handoff and passes that html to chromium", async () => {
		const png = Uint8Array.from(Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
			"base64",
		));
		const source = "![alt](pic.png)\n\n# Title";
		const assets = { "pic.png": { data: png, mediaType: "application/octet-stream" } };
		const prepared = preparePdfExportWithDiagnostics(source, undefined, {}, assets);
		expect(prepared.output.html).toContain("data:image/png;base64,");
		expect(prepared.output.html).not.toContain("pic.png");
		expect(prepared.diagnostics).toEqual([]);
		expect(prepared.headings).toMatchObject([{ depth: 1, text: "Title" }]);

		let html = "";
		const renderHtmlToPdf = vi.fn(async (value: string) => {
			html = value;
			return new Uint8Array([0x25, 0x50, 0x44, 0x46]);
		});
		const adapter: MdiPdfChromiumAdapter = { renderHtmlToPdf };
		await expect(renderPdfWithChromium(source, undefined, adapter, { assets })).resolves.toEqual(
			new Uint8Array([0x25, 0x50, 0x44, 0x46]),
		);
		expect(html).toContain("data:image/png;base64,");
		expect(html).not.toContain("pic.png");
	});

	it("gives an actionable error when the optional PDF adapter cannot load", async () => {
		vi.resetModules();
		vi.doMock("@illusions-lab/mdi-to-pdf", () => {
			throw new Error("not installed");
		});
		const fresh = await import("./node.js");
		await expect(fresh.renderPdfWithChromium("text")).rejects.toThrow(
			"PDF export needs @illusions-lab/mdi-to-pdf",
		);
	});
});
