import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import iconv from "iconv-lite";
import { build, loadExportProfile, mdiToText, mdiToTextFormat, parseArgs } from "./index.js";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdi from "@illusions-lab/mdi-remark";

const run = promisify(execFile);

describe("mdi CLI library", () =>
  it("builds HTML and DOCX output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-"));
    try {
      const input = join(directory, "book.mdi");
      await writeFile(input, "---\ntitle: Book\n---\n{東京|とうきょう}");
      const html = await build(input, "html");
      expect(await readFile(html, "utf8")).toContain("<title>Book</title>");
      const docx = await build(input, "docx");
      expect((await readFile(docx)).subarray(0, 2).toString()).toBe("PK");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }));

describe("parseArgs", () => {
  it("requires an output format", () =>
    expect(parseArgs(["book.mdi"])).toBeUndefined());
  it("parses a supported format", () =>
    expect(parseArgs(["book.mdi", "--to", "html"])).toEqual({
      input: "book.mdi",
      format: "html",
    }));
  it("rejects malformed and unrecognized argument forms", () => {
    for (const args of [
      [],
      ["book.mdi", "--to", "html", "extra"],
      ["book.mdi", "-o", "out.html"],
      ["book.mdi", "--to", "html", "-o"],
      ["book.mdi", "--wat", "html"],
    ]) {
      expect(parseArgs(args)).toBeUndefined();
    }
  });
  it("parses an explicit output path", () =>
    expect(
      parseArgs(["book.mdi", "--to", "epub", "-o", "out/book.epub"])
    ).toEqual({ input: "book.mdi", format: "epub", output: "out/book.epub" }));
  it("accepts TXT formats and profile configuration in either flag order", () =>
    expect(
      parseArgs([
        "book.mdi",
        "--config",
        "book.export.json",
        "--to",
        "txt-ruby",
      ])
    ).toEqual({
      input: "book.mdi",
      format: "txt-ruby",
      config: "book.export.json",
    }));
});

describe("text export", () => {
  it("uses full-width indentation only for paragraphs and preserves ruby on request", () => {
    const processor = unified().use(remarkParse).use(remarkMdi);
    const tree = processor.runSync(
      processor.parse("# 題\n\n{東京|とうきょう}\n\n[[blank]]\n\n次")
    ) as import("mdast").Root;
    expect(
      mdiToText(tree, { text: { fullwidthSpaceIndent: true, indentCount: 2 } })
    ).toBe("題\n　　東京\n\n　　次");
    expect(mdiToText(tree, undefined, true)).toContain("{東京|とうきょう}");
  });

  it("renders stable golden text for every text target", () => {
    const processor = unified().use(remarkParse).use(remarkMdi);
    const tree = processor.runSync(
      processor.parse(
        "# 題\n\n{東京|とうきょう}と[[em:強調]]。[^n]\n\n[^n]: 注の本文"
      )
    ) as import("mdast").Root;
    expect(mdiToTextFormat(tree, undefined, "txt")).toBe("題\n東京と強調。");
    expect(mdiToTextFormat(tree, undefined, "txt-ruby")).toBe(
      "題\n{東京|とうきょう}と強調。"
    );
    expect(mdiToTextFormat(tree, undefined, "narou")).toBe(
      "題\n｜東京《とうきょう》と強調。［注1］\n\nFootnotes\n1. 注の本文"
    );
    expect(mdiToTextFormat(tree, undefined, "kakuyomu")).toBe(
      "題\n｜東京《とうきょう》と《《強調》》。［注1］\n\nFootnotes\n1. 注の本文"
    );
    expect(mdiToTextFormat(tree, undefined, "aozora")).toBe(
      "題［＃「題」は大見出し］\r\n｜東京《とうきょう》と強調［＃「強調」に傍点］。［注1］\r\n\r\nFootnotes\r\n1. 注の本文"
    );
  });

  it("uses non-colliding default filenames for text targets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-text-names-"));
    try {
      const input = join(directory, "kitchen-sink.mdi");
      await writeFile(input, "text");
      await expect(build(input, "txt")).resolves.toBe(join(directory, "kitchen-sink.txt"));
      await expect(build(input, "txt-ruby")).resolves.toBe(join(directory, "kitchen-sink_ruby.txt"));
      await expect(build(input, "narou")).resolves.toBe(join(directory, "kitchen-sink_narou.txt"));
      await expect(build(input, "kakuyomu")).resolves.toBe(join(directory, "kitchen-sink_kakuyomu.txt"));
      await expect(build(input, "aozora")).resolves.toBe(join(directory, "kitchen-sink_aozora.txt"));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("writes every text target with txt-all", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-text-all-"));
    try {
      const input = join(directory, "kitchen-sink.mdi");
      await writeFile(input, "{東京|とうきょう}\n\n次");
      await expect(build(input, "txt-all")).resolves.toEqual([
        join(directory, "kitchen-sink.txt"),
        join(directory, "kitchen-sink_ruby.txt"),
        join(directory, "kitchen-sink_narou.txt"),
        join(directory, "kitchen-sink_kakuyomu.txt"),
        join(directory, "kitchen-sink_aozora.txt"),
      ]);
      const aozora = await readFile(join(directory, "kitchen-sink_aozora.txt"));
      expect(iconv.decode(aozora, "shift_jis")).toContain("｜東京《とうきょう》");
      expect(aozora.includes(Buffer.from("\r\n"))).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves Japanese paired dashes in Shift_JIS Aozora output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-aozora-dashes-"));
    try {
      const input = join(directory, "novel.mdi");
      await writeFile(input, "彼は——振り返らなかった。");
      const output = await build(input, "aozora");
      const decoded = iconv.decode(await readFile(output), "shift_jis");
      expect(decoded).toContain("彼は――振り返らなかった。");
      expect(decoded).not.toContain("?");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("build edge cases", () => {
  it("rejects a missing input with the readable filesystem error", async () => {
    const missing = join(tmpdir(), "mdi-cli-missing-input.mdi");
    await expect(build(missing, "html")).rejects.toThrow(
      /ENOENT.*mdi-cli-missing-input\.mdi/
    );
  });

  it("writes an explicit output in a different directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-output-"));
    try {
      const input = join(directory, "input", "book.mdi");
      const output = join(directory, "output", "book.html");
      await (await import("node:fs/promises")).mkdir(join(directory, "input"));
      await (await import("node:fs/promises")).mkdir(join(directory, "output"));
      await writeFile(input, "# Elsewhere");
      expect(await build(input, "html", output)).toBe(output);
      expect(await readFile(output, "utf8")).toContain("<h1>Elsewhere</h1>");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("loads a profile and resolves its EPUB cover relative to the JSON file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-profile-"));
    try {
      const config = join(directory, "export.json");
      await writeFile(
        config,
        '{"epub":{"coverPath":"cover.png"},"text":{"fullwidthSpaceIndent":true,"indentCount":2}}'
      );
      const profile = await loadExportProfile(config);
      expect(profile?.epub?.coverPath).toBe(join(directory, "cover.png"));
      expect(profile?.text?.indentCount).toBe(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("CLI command output", () => {
  it("writes the default file and reports its absolute path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-command-"));
    try {
      const input = join(directory, "book.mdi");
      const output = join(directory, "book.html");
      await writeFile(input, "# Book");
      const { stdout, stderr } = await run(process.execPath, [
        resolve("dist/cli.js"),
        "build",
        input,
        "--to",
        "html",
      ]);
      expect(stderr).toBe("");
      expect(stdout).toBe(`Written ${output}\n`);
      expect(await readFile(output, "utf8")).toContain("<h1>Book</h1>");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("writes DOCX without emitting a Node web-storage warning", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-docx-command-"));
    try {
      const input = join(directory, "book.mdi");
      const output = join(directory, "book.docx");
      await writeFile(input, "# Book");
      const { stdout, stderr } = await run(process.execPath, [
        resolve("dist/cli.js"),
        "build",
        input,
        "--to",
        "docx",
      ]);
      expect(stderr).toBe("");
      expect(stdout).toBe(`Written ${output}\n`);
      expect((await readFile(output)).subarray(0, 2).toString()).toBe("PK");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("vertical Kitchen Sink export artifacts", () => {
  it("preserves the full fixture across PDF, DOCX, EPUB, and all text targets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-vertical-kitchen-"));
    try {
      const source = (await readFile(
        new URL("../../../examples/kitchen-sink.mdi", import.meta.url),
        "utf8"
      )).replace("writing-mode: horizontal", "writing-mode: vertical");
      const input = join(directory, "kitchen-sink.mdi");
      await writeFile(input, source);
      const [html, pdf, docx, epub, textOutputs] = await Promise.all([
        build(input, "html"),
        build(input, "pdf"),
        build(input, "docx"),
        build(input, "epub"),
        build(input, "txt-all"),
      ]);
      const htmlOutput = await readFile(html, "utf8");
      expect(htmlOutput).toContain("writing-mode: vertical-rl");
      expect(htmlOutput).toContain('<ruby class="mdi-ruby">');
      expect(htmlOutput).toContain("data-footnotes");
      expect((await readFile(pdf)).subarray(0, 5).toString()).toBe("%PDF-");
      const docxZip = await JSZip.loadAsync(await readFile(docx));
      const document = await docxZip.file("word/document.xml")!.async("string");
      expect(document).toContain('w:textDirection w:val="tbRl"');
      expect(document).toContain("<w:ruby ");
      expect(document).toContain("<w:eastAsianLayout");
      expect(document).toContain('<w:footnoteReference w:id="1"/>');
      expect(await docxZip.file("word/footnotes.xml")!.async("string")).toContain("後に事実と判明する。");
      const epubZip = await JSZip.loadAsync(await readFile(epub));
      expect(await epubZip.file("OEBPS/style.css")!.async("string")).toContain("writing-mode:vertical-rl");
      expect(await epubZip.file("OEBPS/package.opf")!.async("string")).toContain('page-progression-direction="rtl"');
      expect(textOutputs).toHaveLength(5);
      expect(await readFile(join(directory, "kitchen-sink_ruby.txt"), "utf8")).toContain("{東京|とうきょう}");
      expect(
        iconv.decode(await readFile(join(directory, "kitchen-sink_aozora.txt")), "shift_jis")
      ).toContain("｜東京《とうきょう》");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
