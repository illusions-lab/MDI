import { describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { renderHtml } from "@illusions-lab/mdi";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdi from "@illusions-lab/mdi-remark";
import { resolveExportProfile } from "@illusions-lab/mdi-export-profile";
import type { Root } from "mdast";
import { applyPdfProfile, mdiToPdf, renderHtmlToPdf } from "./index.js";
import { prepareChromiumPrintProfile } from "./profile.js";

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

describe("renderHtmlToPdf", () =>
  it("acts as a Chromium-only layout adapter for Rust-owned HTML", async () => {
    const pdf = await renderHtmlToPdf(
      "<html><head></head><body><h1>Rust HTML</h1><p>東京</p></body></html>",
      undefined,
      "vertical"
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  }, 30_000));

describe("PDF page-number layout", () => {
  const profile = (format: "simple" | "dash" | "fraction", position: "top-left" | "bottom-right") => ({
    layout: { system: "japanese-publisher" as const, marginMode: "single" as const, bindingSide: "left" as const, gutter: 0 },
    metadata: {},
    typesetting: { writingMode: "horizontal" as const, fontFamily: "serif", textIndentEm: 1, fullwidthSpaceIndent: false },
    pagination: {
      pageSize: "A4" as const,
      landscape: false,
      charactersPerLine: 40,
      linesPerPage: 30,
      gridMode: "strict" as const,
      margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
      pageNumbers: { enabled: true, format, position },
    },
    epub: { chapterSplitLevel: "h1" as const },
    text: { fullwidthSpaceIndent: false, indentCount: 1 },
  });

  it.each([
    ["dash", "top-left"],
    ["fraction", "bottom-right"],
  ] as const)("renders %s numbering at %s", async (format, position) => {
    const pdf = await renderHtmlToPdf(
      "<html><head></head><body><p>numbered</p></body></html>",
      profile(format, position),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});

describe("browser-safe Chromium print profile", () => {
  it("keeps the Playwright adapter and browser hosts on identical CSS", () => {
    const html = "<html><head></head><body><p>本文</p></body></html>";
    const profile = {
      layout: { system: "japanese-publisher" as const },
      typesetting: { writingMode: "vertical" as const },
      pagination: {
        pageSize: "A4" as const,
        landscape: true,
        pageNumbers: { enabled: true, format: "fraction" as const, position: "top-right" as const },
      },
    };
    const prepared = prepareChromiumPrintProfile(html, profile);

    expect(prepared.html).toBe(applyPdfProfile(html, prepared.profile));
    expect(prepared.page).toMatchObject({ widthMm: 297, heightMm: 210, landscape: true });
    expect(prepared.pageNumbers.headerTemplate).toContain('text-align:right');
    expect(prepared.pageNumbers.headerTemplate).toContain('class="totalPages"');
    expect(prepared.pageNumbers.footerTemplate).toBeUndefined();
  });

  it("uses source writing mode and exposes footer metadata without launching Chromium", () => {
    const prepared = prepareChromiumPrintProfile("<p>縦書き</p>", undefined, "vertical");

    expect(prepared.html).toContain('<style id="mdi-export-profile">');
    expect(prepared.html).toContain("writing-mode:vertical-rl");
    expect(prepared.page).toMatchObject({ widthMm: 297, heightMm: 210, landscape: true });
    expect(prepared.pageNumbers).toMatchObject({ enabled: true, position: "bottom-center" });
    expect(prepared.pageNumbers.headerTemplate).toBeUndefined();
    expect(prepared.pageNumbers.footerTemplate).toContain('class="pageNumber"');
  });

  it("keeps browser-safe input validation and creates no header/footer for disabled numbering", () => {
    expect(() => prepareChromiumPrintProfile(null as never)).toThrow("html must be a string");
    const prepared = prepareChromiumPrintProfile(
      "<html><body><p>本文</p></body></html>",
      {
        layout: { system: "word" },
        pagination: { pageNumbers: { enabled: false } },
      },
    );
    expect(prepared.html).toContain("<head><style id=\"mdi-export-profile\">");
    expect(prepared.pageNumbers.headerTemplate).toBeUndefined();
    expect(prepared.pageNumbers.footerTemplate).toBeUndefined();
  });
});

describe("vertical Chromium syntax layout", () => {
  it("keeps documented blank syntax as one strict-grid column", async () => {
    const html = renderHtml(`---
writing-mode: vertical
---

前の段落です。

\\

<br>

<br />

[[blank]]

後の段落です。`);
    const prepared = prepareChromiumPrintProfile(html, {
      layout: { system: "japanese-publisher" },
      typesetting: { writingMode: "vertical" },
    }, "vertical");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(prepared.html);
      const blankColumns = await page.locator(".mdi-blank").evaluateAll((blanks) =>
        blanks.map((blank) => {
          const style = blank.ownerDocument.defaultView!.getComputedStyle(blank);
          return {
            blockSize: blank.getBoundingClientRect().width,
            minimumBlockSize: Number.parseFloat(style.minBlockSize),
            lineHeight: Number.parseFloat(style.lineHeight),
          };
        }),
      );
      expect(blankColumns).toHaveLength(4);
      for (const column of blankColumns) {
        expect(column.minimumBlockSize).toBeGreaterThan(0);
        expect(column.blockSize).toBeCloseTo(column.lineHeight, 2);
        expect(column.blockSize).toBeCloseTo(column.minimumBlockSize, 2);
      }
    } finally {
      await browser.close();
    }
  }, 30_000);
});

describe("PDF export profile", () => {
  it("uses the researched four-six horizontal publisher baseline", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile()
    );
    expect(html).toContain("@page{size:127mm 188mm");
    expect(html).toContain("@page{size:127mm 188mm;margin:16.5mm 15.5mm 18mm 18mm}");
    expect(html).toContain("@page :right{margin:16.5mm 18mm 18mm 15.5mm}");
    expect(html).toContain("@page :left{margin:16.5mm 15.5mm 18mm 18mm}");
    expect(html).not.toContain("body{padding:");
    expect(html).toContain("html{writing-mode:horizontal-tb!important");
    expect(html).not.toContain("p+h1,p+h2,p+h3,p+h4,p+h5,p+h6{padding-top:.75em}");
  });
  it("applies margins through @page so every forced page receives them", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>first</p><div class=\"mdi-pagebreak\"></div><p>second</p></body></html>",
      resolveExportProfile()
    );
    expect(html).toContain("@page{size:127mm 188mm;margin:16.5mm 15.5mm 18mm 18mm}");
    expect(html).toContain("mdi-pagebreak");
    expect(html).not.toContain("padding:20mm");
  });
  it("applies geometry, composition, full-width indentation, and page options", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      {
        layout: { system: "japanese-publisher", marginMode: "mirror", bindingSide: "right", gutter: 0 },
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
          gridMode: "strict",
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
  it("uses physical CJK grid CSS by default", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile()
    );
    expect(html).toContain("--mdi-grid-mode:strict");
    expect(html).toContain("--mdi-characters-per-line:27");
    expect(html).toContain("--mdi-lines-per-page:26");
    expect(html).toMatch(/line-height:5\.903846153846154mm/);
    expect(html).toContain("p{margin:0;text-indent:1em}");
  });
  it("uses the resolved inline pitch for a right-bound vertical manuscript", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile({
        layout: { system: "japanese-publisher" },
        typesetting: { writingMode: "vertical" },
      })
    );
    expect(html).toContain("writing-mode:vertical-rl");
    expect(html).toContain("@page{size:297mm 210mm");
    expect(html).toMatch(/--mdi-character-pitch:3\.70416666666666\d*mm/);
    expect(html).toContain("letter-spacing:0mm");
  });
  it("supports landscape typographic composition without an explicit leading multiplier", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile({
        layout: { system: "japanese-publisher" },
        typesetting: { fullwidthSpaceIndent: true, textIndentEm: 2 },
        pagination: { pageSize: "A4", landscape: true, gridMode: "typographic" },
      })
    );
    expect(html).toContain("@page{size:297mm 210mm");
    expect(html).toContain("writing-mode:horizontal-tb");
    expect(html).toContain("<p>　　本文");
    expect(html).toContain("p{margin:0 0 .75em;text-indent:0}");
  });
  it("uses explicit point size and line spacing only in typographic mode", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile({
        layout: { system: "word" },
        typesetting: { fontSize: 12, lineSpacing: 1.5 },
        pagination: { gridMode: "typographic", charactersPerLine: 60, linesPerPage: 50 },
      })
    );
    expect(html).toMatch(/font-size:4\.23\d+mm;line-height:1\.5/);
    expect(html).toContain("line-height:1.5");
  });
});
