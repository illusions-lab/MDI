import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdi from "@illusions-lab/mdi-remark";
import type { Root } from "mdast";
import { mdiToEpub } from "./index.js";

function parse(source: string): Root {
  const p = unified().use(remarkParse).use(remarkMdi);
  return p.runSync(p.parse(source)) as Root;
}

describe("mdiToEpub", () =>
  it("packages pagebreak segments as EPUB spine chapters", async () => {
    const p = unified().use(remarkParse).use(remarkMdi);
    const zip = await JSZip.loadAsync(
      await mdiToEpub(
        p.runSync(
          p.parse("---\ntitle: Test\n---\none\n\n[[pagebreak]]\n\ntwo")
        ) as Root
      )
    );
    expect(await zip.file("mimetype")!.async("string")).toBe(
      "application/epub+zip"
    );
    // JSZip drops `.options.compression` on reload; compressed === uncompressed
    // size is the reliable signal that STORE (no compression) was used.
    const mimetypeData = (
      zip.file("mimetype") as unknown as {
        _data: { compressedSize: number; uncompressedSize: number };
      }
    )._data;
    expect(mimetypeData.compressedSize).toBe(mimetypeData.uncompressedSize);
    expect(zip.file("META-INF/container.xml")).toBeTruthy();
    const opf = await zip.file("OEBPS/package.opf")!.async("string");
    expect(opf).toContain('<itemref idref="chapter-1"/>');
    expect(opf).toContain('<itemref idref="chapter-2"/>');
    expect(
      Object.keys(zip.files).filter((name) => name.startsWith("OEBPS/chapter-"))
        .length
    ).toBe(2);
  }));

describe("mdiToEpub edge cases", () => {
  it("creates one chapter when no pagebreak is present", async () => {
    const zip = await JSZip.loadAsync(await mdiToEpub(parse("one chapter")));
    expect(
      Object.keys(zip.files)
        .filter((name) => name.startsWith("OEBPS/chapter-"))
        .sort()
    ).toEqual(["OEBPS/chapter-1.xhtml"]);
  });

  it("writes XML-compatible self-closing line breaks", async () => {
    const zip = await JSZip.loadAsync(await mdiToEpub(parse("one[[br]]two")));
    const chapter = await zip.file("OEBPS/chapter-1.xhtml")!.async("string");
    expect(chapter).toContain('<br class="mdi-break"/>');
    expect(chapter).not.toMatch(/<br(?:\s[^>]*)?(?<!\/)>/);
  });

  it("splits chapters for left and right pagebreak variants", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToEpub(
        parse(
          "one\n\n[[pagebreak:right]]\n\ntwo\n\n[[pagebreak:left]]\n\nthree"
        )
      )
    );
    const opf = await zip.file("OEBPS/package.opf")!.async("string");
    expect(
      Object.keys(zip.files).filter((name) => name.startsWith("OEBPS/chapter-"))
        .length
    ).toBe(3);
    expect(opf).toContain('<itemref idref="chapter-3"/>');
  });

  it("XML-escapes metadata and uses fallbacks without front matter", async () => {
    const escaped = await JSZip.loadAsync(
      await mdiToEpub(
        parse(
          '---\ntitle: "A < B & \\"quoted\\""\nauthor: "Me & You"\n---\ntext'
        )
      )
    );
    const opf = await escaped.file("OEBPS/package.opf")!.async("string");
    expect(opf).toContain(
      "<dc:title>A &lt; B &amp; &quot;quoted&quot;</dc:title>"
    );
    expect(opf).toContain("<dc:creator>Me &amp; You</dc:creator>");

    const fallback = await JSZip.loadAsync(await mdiToEpub(parse("text")));
    expect(await fallback.file("OEBPS/package.opf")!.async("string")).toContain(
      "<dc:title>Untitled</dc:title>"
    );
  });

  it("writes cover, profile metadata, vertical progression, styles, and heading chapters", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToEpub(parse("# One\n\ntext\n\n# Two\n\nmore"), {
        profile: {
          metadata: {
            title: "Book",
            author: "Writer",
            publisher: "Press",
            identifier: "isbn:1",
          },
          typesetting: {
            writingMode: "vertical",
            fontFamily: "Noto Serif JP",
            textIndentEm: 2,
          },
          epub: { chapterSplitLevel: "h1" },
        },
        cover: {
          data: new Uint8Array([137, 80, 78, 71]),
          mediaType: "image/png",
        },
      })
    );
    const opf = await zip.file("OEBPS/package.opf")!.async("string");
    const css = await zip.file("OEBPS/style.css")!.async("string");
    expect(zip.file("OEBPS/cover.png")).toBeTruthy();
    expect(opf).toContain("<dc:publisher>Press</dc:publisher>");
    expect(opf).toContain('page-progression-direction="rtl"');
    expect(
      Object.keys(zip.files).filter((name) => name.startsWith("OEBPS/chapter-"))
        .length
    ).toBe(2);
    expect(css).toContain("font-family:Noto Serif JP");
    expect(css).toContain("text-indent:2em");
  });
});
