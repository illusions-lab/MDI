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

  it("keeps vertical writing, ruby, tcy, and footnotes in one real DOCX package", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(
        parse(
          "---\nwriting-mode: vertical\n---\n{東京|とうきょう}^12^脚注[^n]\n\n[^n]: 縦書きの脚注"
        )
      )
    );
    const document = await zip.file("word/document.xml")!.async("string");
    const footnotes = await zip.file("word/footnotes.xml")!.async("string");
    expect(document).toContain('w:textDirection w:val="tbRl"');
    expect(document).toContain("<w:ruby ");
    expect(document).toContain("<w:eastAsianLayout");
    expect(document).toContain('<w:footnoteReference w:id="1"/>');
    expect(footnotes).toContain("縦書きの脚注");
  });

  it("sizes vertical heading ruby from its heading run to prevent overlap", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToDocx(
        parse("---\nwriting-mode: vertical\n---\n# {鏡背|きょうはい}の雪")
      )
    );
    const document = await zip.file("word/document.xml")!.async("string");
    expect(document).toContain('<w:pStyle w:val="Heading1"/>');
    expect(document).toContain(
      '<w:rubyPr><w:rubyAlign w:val="center"/><w:hps w:val="20"/><w:hpsRaise w:val="32"/><w:hpsBaseText w:val="40"/>'
    );
  });
});

describe("mdiToDocx edge cases", () => {
	it("maps landscape, footer dash page numbers, and ordinary first-line indentation", async () => {
		const zip = await JSZip.loadAsync(
			await mdiToDocx(parse("indented paragraph"), {
				typesetting: { writingMode: "horizontal", textIndentEm: 1 },
				pagination: {
					pageSize: "A4",
					landscape: true,
					charactersPerLine: 40,
					linesPerPage: 30,
					margins: { top: 10, bottom: 10, left: 10, right: 10 },
					pageNumbers: { enabled: true, format: "dash", position: "bottom-left" },
				},
			})
		);
		const document = await zip.file("word/document.xml")!.async("string");
		const footer = await zip.file("word/footer1.xml")!.async("string");
		expect(document).toContain('w:w="16838"');
		expect(document).toContain('w:h="11906"');
		expect(document).toContain("w:firstLine=");
		expect(footer).toContain("— ");
		expect(footer).toContain(" —");
	});

	it("serializes breaks, blank/page-break blocks, unlabelled images, and only defined footnotes", async () => {
		const tree = parse("before") as Root;
		tree.children = [
			{ type: "paragraph", children: [
				{ type: "text", value: "before" },
				{ type: "break" },
				{ type: "emphasis", children: [{ type: "text", value: "em" }] },
				{ type: "strong", children: [{ type: "text", value: "strong" }] },
				{ type: "image", url: "image.png", alt: null },
				{ type: "footnoteReference", identifier: "missing", label: "missing" },
			] } as Root["children"][number],
			{ type: "mdiBlank" } as Root["children"][number],
			{ type: "mdiPagebreak" } as Root["children"][number],
		];
		const zip = await JSZip.loadAsync(await mdiToDocx(tree));
		const document = await zip.file("word/document.xml")!.async("string");
		expect(document).toContain("[Image]");
		expect(document).toContain("w:br");
		expect(document).toContain("w:i");
		expect(document).toContain("w:b");
		expect(document).toContain("w:type=\"page\"");
		expect(document).not.toContain("missing");
	});

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
    expect(await zip.file("word/_rels/document.xml.rels")!.async("string")).toContain(
      'Target="https://example.com" TargetMode="External"'
    );
    expect(document).toContain("[Image: diagram]");
    expect(document).toContain('<w:footnoteReference w:id="1"/>');
    expect(await zip.file("word/footnotes.xml")!.async("string")).toContain(
      "definition"
    );
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
