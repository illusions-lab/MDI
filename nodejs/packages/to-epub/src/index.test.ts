import JSZip from "jszip";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { Root } from "mdast";
import { mdiToEpub } from "./index.js";

const require = createRequire(import.meta.url);
const { parse: parseMdi, toPublicationMdast } = require("../../mdi/dist/index.cjs") as {
  parse(source: string): { document: unknown };
  toPublicationMdast(document: unknown): Root;
};

function parse(source: string): Root {
  return toPublicationMdast(parseMdi(source).document);
}

describe("mdiToEpub", () =>
  it("packages pagebreak segments as EPUB spine chapters", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToEpub(
        parse("---\ntitle: Test\n---\none\n\n[[pagebreak]]\n\ntwo")
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
    expect(opf).toMatch(
      /<meta property="dcterms:modified">\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/meta>/
    );
    expect(
      Object.keys(zip.files).filter((name) => name.startsWith("OEBPS/chapter-"))
        .length
    ).toBe(2);
  }));

describe("mdiToEpub edge cases", () => {
  it("rejects every invalid adapter input shape", async () => {
    await expect(mdiToEpub(null as never)).rejects.toThrow(
      "tree must be an mdast root",
    );
    await expect(
      mdiToEpub({ type: "paragraph", children: [] } as never),
    ).rejects.toThrow("tree must be an mdast root");
    await expect(
      mdiToEpub({ type: "root", children: null } as never),
    ).rejects.toThrow("tree must be an mdast root");

    const tree = parse("text");
    for (const options of [null, 1, []]) {
      await expect(mdiToEpub(tree, options as never)).rejects.toThrow(
        "options must be an object",
      );
    }
    for (const profile of [null, 1, []]) {
      await expect(
        mdiToEpub(tree, { profile: profile as never }),
      ).rejects.toThrow("profile must be an object");
    }
    for (const cover of [null, 1, []]) {
      await expect(
        mdiToEpub(tree, { cover: cover as never }),
      ).rejects.toThrow("cover must be an object");
    }
    await expect(
      mdiToEpub(tree, {
        cover: { data: "not bytes", mediaType: "image/png" } as never,
      }),
    ).rejects.toThrow("cover.data must be a Uint8Array");
    await expect(
      mdiToEpub(tree, {
        cover: {
          data: new Uint8Array(),
          mediaType: "image/gif",
        } as never,
      }),
    ).rejects.toThrow("cover.mediaType must be image/jpeg or image/png");
  });

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

  it("writes XHTML-safe values for footnote data attributes", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToEpub(parse("A note[^1].\n\n[^1]: note text"))
    );
    const chapter = await zip.file("OEBPS/chapter-1.xhtml")!.async("string");

    expect(chapter).toContain('data-footnote-ref=""');
    expect(chapter).toContain('data-footnotes=""');
    expect(chapter).toContain('data-footnote-backref=""');
    expect(chapter).not.toMatch(/\sdata-footnote-ref(?=\s|>)/);
  });

  it("keeps a split footnote and its ARIA target in the referencing content document", async () => {
    const zip = await JSZip.loadAsync(
      await mdiToEpub(
        parse("A note[^1].\n\n[[pagebreak]]\n\nafter\n\n[^1]: note text")
      )
    );
    const first = await zip.file("OEBPS/chapter-1.xhtml")!.async("string");
    const second = await zip.file("OEBPS/chapter-2.xhtml")!.async("string");

    expect(first).toContain('href="#user-content-fn-1"');
    expect(first).toContain('aria-describedby="footnote-label"');
    expect(first).toContain('id="user-content-fn-1"');
    expect(first).toContain('href="#user-content-fnref-1"');
    expect(second).not.toContain("user-content-fn-1");
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
            fontSize: 11,
            textIndentEm: 2,
            fullwidthSpaceIndent: true,
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
    expect(css).toContain("font-size:11pt");
    expect(css).toContain("text-indent:2em");
    expect(css).toContain("--mdi-fullwidth-space-indent:1");
    expect(css).toContain("writing-mode:vertical-rl");
	});

	it("uses front matter metadata, an explicit no-split profile, and safe horizontal CSS", async () => {
		const zip = await JSZip.loadAsync(
			await mdiToEpub(
				parse(
					"---\ntitle: Front matter title\nlang: en\ndate: 2026-07-21\n---\nfirst\n\n[[pagebreak]]\n\nsecond"
				),
				{
					profile: {
						typesetting: { writingMode: "horizontal", fontFamily: "{}<>;", textIndentEm: 0 },
						epub: { chapterSplitLevel: "none" },
					},
				}
			)
		);
		const opf = await zip.file("OEBPS/package.opf")!.async("string");
		const css = await zip.file("OEBPS/style.css")!.async("string");
		expect(opf).toContain("<dc:title>Front matter title</dc:title>");
		expect(opf).toContain("<dc:language>en</dc:language>");
		expect(opf).toContain("<dc:date>2026-07-21</dc:date>");
		expect(opf).not.toContain("page-progression-direction");
		expect(css).toContain("font-family:serif");
		expect(Object.keys(zip.files).filter((name) => name.startsWith("OEBPS/chapter-"))).toEqual([
			"OEBPS/chapter-1.xhtml",
		]);
	});

	it("packages JPEG covers", async () => {
		const zip = await JSZip.loadAsync(
			await mdiToEpub(parse("[[pagebreak]]\n\n[[pagebreak]]\n\n# One\n\nbody"), {
				cover: { data: new Uint8Array([0xff, 0xd8, 0xff]), mediaType: "image/jpeg" },
			})
		);
		const opf = await zip.file("OEBPS/package.opf")!.async("string");
		expect(zip.file("OEBPS/cover.jpg")).toBeTruthy();
		expect(opf).toContain('href="cover.jpg" media-type="image/jpeg"');
	});
});
