import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { build } from "./index.js";

const run = promisify(execFile);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const illustrated = `![body](body.png)

| cell |
| --- |
| ![table](table.png) |

See [^n].

[^n]: ![note](note.png)

[[warichu:![cut](cut.png)]]
`;

describe("self-contained CLI images", () => {
  it("embeds local images and keeps the artifacts after those files are deleted", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-images-"));
    try {
      const input = join(directory, "book.mdi");
      await writeFile(input, illustrated);
      for (const name of ["body.png", "table.png", "note.png", "cut.png"]) {
        await writeFile(join(directory, name), png);
      }
      const htmlPath = await build(input, "html");
      const docxPath = await build(input, "docx");
      const epubPath = await build(input, "epub");
      const pdfPath = await build(input, "pdf");
      for (const name of ["body.png", "table.png", "note.png", "cut.png"]) {
        await rm(join(directory, name));
      }
      const html = await readFile(htmlPath, "utf8");
      expect(html).toContain("data:image/png;base64,");
      for (const name of ["body.png", "table.png", "note.png", "cut.png"]) {
        expect(html).not.toContain(name);
      }
      const pdf = await readFile(pdfPath);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.toString("latin1")).toContain("/Image");

      const docx = await JSZip.loadAsync(await readFile(docxPath));
      const media = Object.keys(docx.files).filter((name) => name.startsWith("word/media/")).sort();
      expect(media).toEqual([
        "word/media/image1.png",
        "word/media/image2.png",
        "word/media/image3.png",
        "word/media/image4.png",
      ]);
      const document = await docx.file("word/document.xml")!.async("string");
      expect(document).toContain("r:embed=\"rImg");
      expect(document).toContain("w:eastAsianLayout");
      const footnotes = await docx.file("word/footnotes.xml")!.async("string");
      expect(footnotes).toContain("r:embed=\"rFnImg");
      const footnoteRels = await docx.file("word/_rels/footnotes.xml.rels")!.async("string");
      expect(footnoteRels).toContain("media/image");
      expect(Object.keys(docx.files).some((name) => name.includes(".."))).toBe(false);

      const epub = await JSZip.loadAsync(await readFile(epubPath));
      const images = Object.keys(epub.files).filter((name) => name.startsWith("OEBPS/images/"));
      expect(images).toHaveLength(4);
      const chapter = await epub.file("OEBPS/chapter-1.xhtml")!.async("string");
      expect(chapter).toContain("images/image1.png");
      expect(chapter).not.toContain("body.png");

      const project = fileURLToPath(new URL("../../../format-contracts/openxml-validator/OpenXmlValidator.csproj", import.meta.url));
      await run("dotnet", ["run", "--project", project, "--configuration", "Release", "--", docxPath], {
        env: { ...process.env, DOTNET_ROLL_FORWARD: process.env.DOTNET_ROLL_FORWARD ?? "Major" },
        timeout: 180_000,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 180_000);

  it("does not read the disk when assets are supplied, and text export never loads images", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-assets-"));
    try {
      const input = join(directory, "book.mdi");
      await writeFile(input, "![x](missing.png)\n");
      const htmlPath = await build(input, "html", {
        assets: { "missing.png": { data: png, mediaType: "application/octet-stream" } },
      });
      const html = await readFile(htmlPath, "utf8");
      expect(html).toContain("data:image/png;base64,");
      expect(html).not.toContain("missing.png");
      const textPath = await build(input, "txt");
      expect(await readFile(textPath, "utf8")).not.toContain("data:image");
      const notePath = await build(input, "note");
      const note = await readFile(notePath, "utf8");
      expect(note).toContain("missing.png");
      expect(note).not.toContain("data:image");
      const jsonPath = await build(input, "json");
      const json = await readFile(jsonPath, "utf8");
      expect(json).toContain("missing.png");
      expect(json).not.toContain("data:image");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
