import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { renderHtml } from "@illusions-lab/mdi";
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

- ![item](list.png)
`;

describe("self-contained CLI images", () => {
  it("embeds local images and keeps the artifacts after those files are deleted", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-images-"));
    try {
      const input = join(directory, "book.mdi");
      await writeFile(input, illustrated);
      for (const name of ["body.png", "table.png", "note.png", "cut.png", "list.png"]) {
        await writeFile(join(directory, name), png);
      }
      const htmlPath = await build(input, "html");
      const docxPath = await build(input, "docx");
      const epubPath = await build(input, "epub");
      const pdfPath = await build(input, "pdf");
      for (const name of ["body.png", "table.png", "note.png", "cut.png", "list.png"]) {
        await rm(join(directory, name));
      }
      const html = await readFile(htmlPath, "utf8");
      expect(html).toContain("data:image/png;base64,");
      expect(html).toContain("<li>");
      for (const name of ["body.png", "table.png", "note.png", "cut.png", "list.png"]) {
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
        "word/media/image5.png",
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
      expect(images).toHaveLength(5);
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

  it("fits images with the default publication profile for each writing mode", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-fit-"));
    const wide = widePng(2000, 1);
    const assets = { "wide.png": { data: wide, mediaType: "image/png" } };
    try {
      const horizontalInput = join(directory, "horizontal.mdi");
      const horizontalSource = "![wide](wide.png)\n";
      await writeFile(horizontalInput, horizontalSource);
      const horizontal = await readFile(await build(horizontalInput, "html", { assets }), "utf8");
      expect(horizontal).toBe(renderHtml(horizontalSource, {
        assets,
        profile: { layout: { system: "word" }, typesetting: { writingMode: "horizontal" } },
      }));

      const verticalInput = join(directory, "vertical.mdi");
      const verticalSource = "---\nwriting-mode: vertical\n---\n\n![wide](wide.png)\n";
      await writeFile(verticalInput, verticalSource);
      const vertical = await readFile(await build(verticalInput, "html", { assets }), "utf8");
      expect(vertical).toBe(renderHtml(verticalSource, {
        assets,
        profile: { layout: { system: "japanese-publisher" }, typesetting: { writingMode: "vertical" } },
      }));

      const horizontalWidth = horizontal.match(/width="(\d+)"/)?.[1];
      const verticalWidth = vertical.match(/width="(\d+)"/)?.[1];
      expect(horizontalWidth).toBeTruthy();
      expect(verticalWidth).toBeTruthy();
      expect(horizontalWidth).not.toBe(verticalWidth);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function widePng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([prefix, body, checksum]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
