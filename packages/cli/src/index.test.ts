import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { build, loadExportProfile, mdiToText, parseArgs } from "./index.js";
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
});
