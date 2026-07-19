import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdi from "@illusions-lab/mdi-remark";
import type { Root } from "mdast";
import { mdiToDocx } from "./index.js";

function parse(source: string): Root {
  const p = unified().use(remarkParse).use(remarkMdi);
  return p.runSync(p.parse(source)) as Root;
}

describe("mdiToDocx", () =>
  it("creates a DOCX containing ordinary, ruby, and tcy runs", async () => {
    const p = unified().use(remarkParse).use(remarkMdi);
    const zip = await JSZip.loadAsync(
      await mdiToDocx(
        p.runSync(p.parse("# Heading\n\nplain {東京|とうきょう} ^12^")) as Root
      )
    );
    const document = await zip.file("word/document.xml")!.async("string");
    expect(document).toContain("<w:document");
    expect(document).toContain("<w:ruby ");
    expect(document).toContain("<w:eastAsianLayout");
    expect(document).not.toContain("<undefined>");
    expect(document).not.toContain("</undefined>");
  }));

describe("DOCX heading styles", () => {
  it("defines an all-black H1-H9 hierarchy and print block styles", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(parse("# One\n\n## Two\n\n### Three"), {
        typesetting: { fontFamily: "Noto Serif JP" },
      })
    );
    const document = await zip.file("word/document.xml")!.async("string");
    const styles = await zip.file("word/styles.xml")!.async("string");
    expect(document).toContain('<w:pStyle w:val="Heading1"/>');
    for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(styles).toContain(`w:styleId="Heading${level}"`);
      expect(styles).toMatch(
        new RegExp(
          `w:styleId="Heading${level}"[\\s\\S]*?w:color w:val="000000"`
        )
      );
    }
    expect(styles).toContain('w:rFonts w:ascii="Noto Serif JP"');
    expect(styles).toContain('w:styleId="MdiQuote"');
    expect(styles).toContain('w:styleId="MdiList"');
    expect(styles).toContain('w:styleId="MdiCode"');
    expect(styles).toContain('w:styleId="MdiThematicBreak"');
  });
});

describe("DOCX print defaults", () => {
  it("writes conventional A4 portrait geometry and black heading styles", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(parse("# Heading\n\nBody text"))
    );
    const document = await zip.file("word/document.xml")!.async("string");
    const styles = await zip.file("word/styles.xml")!.async("string");
    expect(document).toContain('w:w="11906"'); // A4 width in twips
    expect(document).toContain('w:h="16838"'); // A4 height in twips
    expect(document).toContain(
      'w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"'
    );
    expect(document).not.toContain("w:textDirection");
    expect(styles).toMatch(
      /w:styleId="Heading1"[\s\S]*?w:color w:val="000000"/
    );
  });
});

describe("mdiToDocx edge cases", () => {
  it("keeps supported GFM list, table, and inline content", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(
        parse(
          "- [x] done ~~old~~ {東京|とうきょう}\n\n| A | B |\n| - | - |\n| dropped | table |"
        )
      )
    );
    const document = await zip.file("word/document.xml")!.async("string");
    expect(document).toContain("done");
    expect(document).toContain("<w:strike/>");
    expect(document).toContain("<w:ruby ");
    expect(document).toContain("dropped");
    expect(document).toContain("w:tbl");
    expect(document).toContain('w:type="dxa"');
  });

  it("preserves inline code, image alt text, links, and footnote references", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(
        parse("`code` [link text](https://example.com) ![diagram](image.png) note[^a]\n\n[^a]: definition")
      )
    );
    const document = await zip.file("word/document.xml")!.async("string");
    expect(document).toContain("code");
    expect(document).toContain("link text");
    expect(document).toContain("[Image: diagram]");
    expect(document).toContain("[a]");
  });

  it("maps quotes, fenced code, and thematic breaks to their print styles", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(
        parse(
          "> quoted text\n\n```ts\nconst value = 1;\n```\n\n---\n\n- listed item"
        )
      )
    );
    const document = await zip.file("word/document.xml")!.async("string");
    expect(document).toContain('w:pStyle w:val="MdiQuote"');
    expect(document).toContain('w:pStyle w:val="MdiCode"');
    expect(document).toContain('w:pStyle w:val="MdiThematicBreak"');
    expect(document).toContain('w:pStyle w:val="MdiList"');
    expect(document).toContain("const value = 1;");
  });

  it("serializes split ruby readings as a dot-joined Word ruby reading", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(parse("{東京|とう.きょう}"))
    );
    const document = await zip.file("word/document.xml")!.async("string");
    expect(document).toContain("<w:rt><w:r><w:t>とう.きょう</w:t>");
  });

  it("generates ordinary DOCX content without ruby or tcy XML", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(parse("# Heading\n\nPlain text"))
    );
    const document = await zip.file("word/document.xml")!.async("string");
    expect(document).toContain("Plain text");
    expect(document).not.toContain("<w:ruby>");
    expect(document).not.toContain("<w:eastAsianLayout");
  });

  it("maps paper, typography, margins, full-width indentation, and page numbers to OOXML", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(parse("paragraph"), {
        typesetting: {
          writingMode: "horizontal",
          fontFamily: "Noto Serif JP",
          textIndentEm: 2,
          fullwidthSpaceIndent: true,
        },
        pagination: {
          pageSize: "A4",
          landscape: false,
          charactersPerLine: 40,
          linesPerPage: 30,
          margins: { top: 10, bottom: 11, left: 12, right: 13 },
          pageNumbers: {
            enabled: true,
            format: "fraction",
            position: "top-right",
          },
        },
      })
    );
    const document = await zip.file("word/document.xml")!.async("string");
    const header = await zip.file("word/header1.xml")!.async("string");
    expect(document).toContain('w:w="11906"'); // A4 width in twips
    expect(document).toContain('w:top="567"');
    expect(document).toContain('<w:t xml:space="preserve">　　</w:t>');
    expect(document).toContain("paragraph");
    expect(header).toContain(">PAGE<");
    expect(header).toContain("NUMPAGES");
  });
});
