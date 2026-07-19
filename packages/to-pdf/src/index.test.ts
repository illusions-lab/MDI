import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdi from "@illusions-lab/mdi-remark";
import { resolveExportProfile } from "@illusions-lab/mdi-export-profile";
import type { Root } from "mdast";
import { applyPdfProfile, mdiToPdf } from "./index.js";

describe("mdiToPdf", () =>
  it("generates a browser-rendered PDF", async () => {
    const p = unified().use(remarkParse).use(remarkMdi);
    const tree = p.runSync(
      p.parse("---\nwriting-mode: vertical\n---\n{東京|とうきょう}")
    ) as Root;
    const pdf = await mdiToPdf(tree);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  }, 30_000));

describe("mdiToPdf edge cases", () => {
  it("renders plain Markdown and can be called repeatedly", async () => {
    const p = unified().use(remarkParse).use(remarkMdi);
    const tree = p.runSync(
      p.parse("# Plain heading\n\nA regular paragraph.")
    ) as Root;
    const [first, second] = await Promise.all([mdiToPdf(tree), mdiToPdf(tree)]);

    for (const pdf of [first, second]) {
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(500);
    }
  }, 30_000);
});

describe("PDF export profile", () => {
  it("uses a readable A4 portrait baseline for horizontal documents", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile()
    );
    expect(html).toContain("@page{size:210mm 297mm");
    expect(html).toContain("@page{size:210mm 297mm;margin:25.4mm 25.4mm 25.4mm 25.4mm}");
    expect(html).not.toContain("body{padding:");
    expect(html).toContain("html{writing-mode:horizontal-tb!important");
  });
  it("applies margins through @page so every forced page receives them", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>first</p><div class=\"mdi-pagebreak\"></div><p>second</p></body></html>",
      resolveExportProfile()
    );
    expect(html).toContain("@page{size:210mm 297mm;margin:25.4mm 25.4mm 25.4mm 25.4mm}");
    expect(html).toContain("mdi-pagebreak");
    expect(html).not.toContain("padding:25.4mm");
  });
  it("applies geometry, composition, full-width indentation, and page options", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      {
        metadata: {},
        typesetting: {
          writingMode: "vertical",
          fontFamily: "Noto Serif JP",
          textIndentEm: 2,
          fullwidthSpaceIndent: true,
        },
        pagination: {
          pageSize: "A4",
          landscape: false,
          charactersPerLine: 40,
          linesPerPage: 30,
          margins: { top: 34, bottom: 28, left: 28, right: 45 },
          pageNumbers: {
            enabled: true,
            format: "fraction",
            position: "bottom-center",
          },
        },
        epub: { chapterSplitLevel: "h1" },
        text: { fullwidthSpaceIndent: false, indentCount: 1 },
      }
    );
    expect(html).toContain("@page{size:210mm 297mm");
    expect(html).toContain("writing-mode:vertical-rl");
    expect(html).toContain("font-family:Noto Serif JP");
    expect(html).toContain("<p>　　本文");
  });
});
