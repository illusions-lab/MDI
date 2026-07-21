import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import iconv from "iconv-lite";
import { build, loadExportProfile, parseArgs } from "./index.js";
import { isCliEntrypoint, run as runCli, setCliExitCode } from "./cli.js";

const runCommand = promisify(execFile);

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
      const horizontal = await JSZip.loadAsync(await readFile(docx));
      const horizontalXml = await horizontal.file("word/document.xml")!.async("string");
      // CLI horizontal default is the Word A4 flowing profile, not Rust's bare baseline.
      expect(horizontalXml).toContain('w:w="11906"');
      expect(horizontalXml).not.toContain('w:type="linesAndChars"');

      await writeFile(input, "---\nwriting-mode: vertical\n---\n本文");
      const verticalPath = await build(input, "docx", { output: join(directory, "vertical.docx") });
      const vertical = await JSZip.loadAsync(await readFile(verticalPath));
      const verticalXml = await vertical.file("word/document.xml")!.async("string");
      // CLI vertical default is the A4 landscape Japanese novel manuscript.
      expect(verticalXml).toContain('w:w="16838"');
      expect(verticalXml).toContain('w:h="11906"');
      expect(verticalXml).toContain('w:textDirection w:val="tbRl"');
      expect(verticalXml).toContain('w:linePitch="455"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }));

describe("CLI publication defaults", () => {
  it("rejects an unsupported library output target instead of writing an empty file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-invalid-"));
    try {
      const input = join(directory, "book.mdi");
      await writeFile(input, "text");
      await expect(build(input, "invalid" as never)).rejects.toThrow("Unsupported output format: invalid");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

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

  it.each(["narou", "kakuyomu", "aozora", "txt-all"] as const)(
    "accepts the %s text target",
    (format) => {
      expect(parseArgs(["book.mdi", "--to", format])).toEqual({
        input: "book.mdi",
        format,
      });
    }
  );
});

describe("CLI executable entrypoint", () => {
  it("recognizes the resolved module path used by npm bin symlinks", () => {
    expect(isCliEntrypoint(import.meta.url, fileURLToPath(import.meta.url))).toBe(true);
    expect(isCliEntrypoint(import.meta.url, process.execPath)).toBe(false);
  });

  it("sets the process status through the executable command path", async () => {
    const previousExitCode = process.exitCode;
    try {
      await setCliExitCode(async () => 7);
      expect(process.exitCode).toBe(7);
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});

describe("text export", () => {
  it("renders all text targets through the Rust source API", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-text-rust-"));
    try {
      const input = join(directory, "book.mdi");
      await writeFile(input, "# 題\n\n{東京|とうきょう}と[[em:強調]]。");
      const outputs = await Promise.all([
        build(input, "txt"),
        build(input, "txt-ruby"),
        build(input, "narou"),
        build(input, "kakuyomu"),
        build(input, "aozora"),
      ]);
      expect(await readFile(outputs[0], "utf8")).toBe("題\n東京と強調。");
      expect(await readFile(outputs[1], "utf8")).toContain("{東京|とうきょう}");
      expect(await readFile(outputs[2], "utf8")).toContain("｜東京《とうきょう》");
      expect(await readFile(outputs[3], "utf8")).toContain("《《強調》》");
      expect(iconv.decode(await readFile(outputs[4]), "shift_jis")).toContain("［＃「題」は大見出し］");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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

  it("accepts a string output shorthand and rejects -o for txt-all", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-output-shorthand-"));
    try {
      const input = join(directory, "book.mdi");
      const output = join(directory, "explicit.html");
      await writeFile(input, "text");
      await expect(build(input, "html", output)).resolves.toBe(output);
      await expect(build(input, "txt-all", { output })).rejects.toThrow("does not accept -o");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
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
        '{"layout":{"system":"japanese-publisher"},"epub":{"coverPath":"cover.png"},"text":{"fullwidthSpaceIndent":true,"indentCount":2}}'
      );
      const profile = await loadExportProfile(config);
      expect(profile?.epub?.coverPath).toBe(join(directory, "cover.png"));
      expect(profile?.text?.indentCount).toBe(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("applies configured EPUB and DOCX profiles, including a PNG cover", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-configured-publication-"));
    try {
      const input = join(directory, "book.mdi");
      const cover = join(directory, "cover.png");
      await writeFile(input, "# One\n\ntext\n\n# Two\n\nmore");
      await writeFile(cover, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const profile = {
        layout: { system: "japanese-publisher" as const },
        metadata: { title: "Configured CLI book" },
        typesetting: { writingMode: "vertical" as const, fontFamily: "Noto Serif JP" },
        pagination: { pageSize: "A5" as const, pageNumbers: { enabled: true, position: "top-right" as const } },
        epub: { coverPath: cover, chapterSplitLevel: "h1" as const },
      };
      const epub = await build(input, "epub", { profile });
      const epubZip = await JSZip.loadAsync(await readFile(epub));
      expect(epubZip.file("OEBPS/cover.png")).toBeTruthy();
      expect(await epubZip.file("OEBPS/package.opf")!.async("string")).toContain("Configured CLI book");
      expect(Object.keys(epubZip.files).filter((name) => name.startsWith("OEBPS/chapter-"))).toHaveLength(2);

      const docx = await build(input, "docx", { profile });
      const docxZip = await JSZip.loadAsync(await readFile(docx));
      expect(await docxZip.file("word/document.xml")!.async("string")).toContain('w:textDirection w:val="tbRl"');
      expect(await docxZip.file("word/document.xml")!.async("string")).toContain('w:w="8391"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("loads JPEG covers and rejects an unsupported configured cover", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-cover-formats-"));
    try {
      const input = join(directory, "book.mdi");
      const jpeg = join(directory, "cover.jpg");
      const invalid = join(directory, "cover.gif");
      await writeFile(input, "text");
      await writeFile(jpeg, Buffer.from([0xff, 0xd8, 0xff, 0x00]));
      await writeFile(invalid, Buffer.from("GIF89a"));
      const output = await build(input, "epub", { profile: { layout: { system: "word" }, epub: { coverPath: jpeg } } });
      const zip = await JSZip.loadAsync(await readFile(output));
      expect(zip.file("OEBPS/cover.jpg")).toBeTruthy();
      await expect(build(input, "epub", { profile: { layout: { system: "word" }, epub: { coverPath: invalid } } }))
        .rejects.toThrow("EPUB cover must be a PNG or JPEG");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("CLI command output", () => {

  it("returns success and reports every output written by the command adapter", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-run-success-"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const input = join(directory, "book.mdi");
      await writeFile(input, "text");
      await expect(runCli(["build", input, "--to", "txt-all"])).resolves.toBe(0);
      expect(log).toHaveBeenCalledTimes(5);
      expect(log).toHaveBeenCalledWith(`Written ${join(directory, "book.txt")}`);
      expect(log).toHaveBeenCalledWith(`Written ${join(directory, "book_aozora.txt")}`);
    } finally {
      log.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("returns a usage status for malformed commands", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(runCli(["wat"])).resolves.toBe(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Usage: mdi build"));
    } finally {
      error.mockRestore();
    }
  });

  it("returns a readable failure status instead of throwing from the command adapter", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(runCli(["build", join(tmpdir(), "missing-cli-input.mdi"), "--to", "html"])).resolves.toBe(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("ENOENT"));
    } finally {
      error.mockRestore();
    }
  });

  it("writes the default file and reports its absolute path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-command-"));
    try {
      const input = join(directory, "book.mdi");
      const output = join(directory, "book.html");
      await writeFile(input, "# Book");
      const { stdout, stderr } = await runCommand(process.execPath, [
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
      const { stdout, stderr } = await runCommand(process.execPath, [
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
  it("uses Rust source renderers for HTML, EPUB, DOCX and text, then sends Rust HTML to PDF", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-vertical-kitchen-"));
    try {
      const source = (await readFile(
        new URL("../../../../examples/kitchen-sink.mdi", import.meta.url),
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
      expect(document).toContain("東京");
      expect(document).toContain("とうきょう");
      expect(await docxZip.file("docProps/core.xml")!.async("string")).toContain("MDI Kitchen Sink");
      const epubZip = await JSZip.loadAsync(await readFile(epub));
      expect(await epubZip.file("OEBPS/style.css")!.async("string")).toContain("writing-mode:vertical-rl");
      expect(await epubZip.file("OEBPS/package.opf")!.async("string")).toContain('page-progression-direction="rtl"');
      expect(await epubZip.file("OEBPS/chapter-1.xhtml")!.async("string")).toContain('<ruby class="mdi-ruby">');
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
