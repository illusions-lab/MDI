import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import iconv from "iconv-lite";
import { build, loadExportProfile, parseArgs, parseCommand } from "./index.js";
import { isCliEntrypoint, notifyUpdate, run as runCli, setCliExitCode, updateCommand, type UpdateServices } from "./cli.js";
import { compareVersions, currentVersion, installLatest, latestVersion } from "./version.js";

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
  it("parses JSON output", () =>
    expect(parseArgs(["book.mdi", "--to", "json", "-o", "book.json"])).toEqual({
      input: "book.mdi",
      format: "json",
      output: "book.json",
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

  it.each(["narou", "kakuyomu", "aozora", "note", "txt-all"] as const)(
    "accepts the %s text target",
    (format) => {
      expect(parseArgs(["book.mdi", "--to", format])).toEqual({
        input: "book.mdi",
        format,
      });
    }
  );
});

describe("public command parser", () => {
  it("supports shorthand HTML and output-extension inference", () => {
    expect(parseCommand(["book.mdi"])).toEqual({ command: "build", args: { input: "book.mdi", format: "html" } });
    expect(parseCommand(["book.mdi", "-o", "result.epub"])).toEqual({
      command: "build", args: { input: "book.mdi", format: "epub", output: "result.epub" },
    });
    expect(parseCommand(["build", "book.mdi"])).toEqual({ command: "build", args: { input: "book.mdi", format: "html" } });
  });

  it("rejects an explicit format that conflicts with the output extension", () => {
    expect(parseCommand(["book.mdi", "--to", "json", "-o", "result.html"])).toBeUndefined();
    expect(parseCommand(["book.mdi", "--to", "txt-ruby", "-o", "result.txt"])).toEqual({
      command: "build", args: { input: "book.mdi", format: "txt-ruby", output: "result.txt" },
    });
    expect(parseCommand(["book.mdi", "--to", "json", "-o", "result.json"])).toEqual({
      command: "build", args: { input: "book.mdi", format: "json", output: "result.json" },
    });
  });

  it("reports the reason for a format/output conflict", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(runCli(["book.mdi", "--to", "json", "-o", "result.html"])).resolves.toBe(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("conflicts with the output filename extension"));
    } finally {
      error.mockRestore();
    }
  });

  it("recognizes check, update, version, and help commands", () => {
    expect(parseCommand(["check", "book.mdi"])).toEqual({ command: "check", input: "book.mdi" });
    expect(parseCommand(["update", "--check"])).toEqual({ command: "update", checkOnly: true, yes: false });
    expect(parseCommand(["update", "--yes"])).toEqual({ command: "update", checkOnly: false, yes: true });
    expect(parseCommand(["--version"])).toEqual({ command: "version" });
    expect(parseCommand(["--help"])).toEqual({ command: "help" });
    expect(parseCommand(["update", "--help"])).toEqual({ command: "help" });
    expect(parseCommand(["update", "--unknown"])).toBeUndefined();
    expect(parseCommand(["book.mdi", "--config", "profile.json"])).toEqual({ command: "build", args: { input: "book.mdi", format: "html", config: "profile.json" } });
    expect(parseCommand(["book.mdi", "--config", "profile.json", "--unknown", "value"])).toBeUndefined();
  });
});

describe("version service", () => {
  it("reads the installed package version", () => expect(currentVersion()).toBe("2.0.18"));

  it.each([
    ["2.1.0", "2.0.18", 1], ["2.0.18", "2.0.18", 0], ["2.0.17", "2.0.18", -1],
    ["2.0.18-beta.1", "2.0.18", -1], ["2.0.18", "2.0.18-beta.1", 1],
  ])("compares semver %s and %s", (left, right, expected) => expect(compareVersions(left, right)).toBe(expected));

  it("handles prerelease identifier ordering and unequal lengths", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-alpha.1")).toBe(-1);
    expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha")).toBe(1);
    expect(compareVersions("1.0.0-alpha.2", "1.0.0-alpha.10")).toBe(-1);
    expect(compareVersions("1.0.0-alpha.10", "1.0.0-alpha.2")).toBe(1);
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
    expect(compareVersions("1.0.0-beta", "1.0.0-alpha")).toBe(1);
    expect(compareVersions("1.0.0+build.2", "v1.0.0+build.1")).toBe(0);
  });

  it("uses a fresh registry result once and then the daily cache", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-version-cache-"));
    try {
      const cacheFile = join(directory, "update-check.json");
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ "dist-tags": { latest: "9.9.9" } }), { status: 200 }));
      const now = () => Date.parse("2026-08-02T00:00:00.000Z");
      await expect(latestVersion({ cacheFile, fetchImpl, now })).resolves.toBe("9.9.9");
      await expect(latestVersion({ cacheFile, fetchImpl, now: () => now() + 60_000 })).resolves.toBe("9.9.9");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refreshes an expired cache and reports registry errors", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-version-expired-"));
    try {
      const cacheFile = join(directory, "update-check.json");
      await writeFile(cacheFile, JSON.stringify({ registryUrl: "https://registry.example", checkedAt: "2020-01-01T00:00:00.000Z", latestVersion: "1.0.0" }));
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ "dist-tags": {} }), { status: 200 }));
      await expect(latestVersion({ registryUrl: "https://registry.example", cacheFile, fetchImpl, now: () => Date.parse("2026-08-02T00:00:00.000Z") })).rejects.toThrow("dist-tags.latest");
      await expect(latestVersion({ registryUrl: "https://registry.example", cacheFile, fetchImpl: vi.fn(async () => new Response("", { status: 503 })) })).rejects.toThrow("HTTP 503");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("runs the npm installer without a shell and reports failures", async () => {
    const makeChild = (code: number) => {
      const child = { once: (event: string, callback: (value?: number) => void) => {
        if (event === "exit") queueMicrotask(() => callback(code));
        return child;
      } } as never;
      return child;
    };
    const spawnImpl = vi.fn(() => makeChild(0));
    await expect(installLatest({ spawnImpl: spawnImpl as never })).resolves.toBeUndefined();
    expect(spawnImpl).toHaveBeenCalledWith("npm", ["install", "--global", "@illusions-lab/mdi-cli@latest"], expect.objectContaining({ shell: false }));
    await expect(installLatest({ spawnImpl: vi.fn(() => makeChild(1)) as never })).rejects.toThrow("status 1");
  });
});

describe("update command", () => {
  const services = (overrides: Partial<UpdateServices> = {}): UpdateServices => ({
    currentVersion: () => "1.0.0",
    latestVersion: async () => "2.0.0",
    compareVersions: (left, right) => left === right ? 0 : left > right ? 1 : -1,
    installLatest: async () => undefined,
    isInteractive: () => false,
    prompt: async () => "n",
    ...overrides,
  });

  it("checks without installing and handles non-interactive updates", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(updateCommand(true, false, services())).resolves.toBe(0);
      await expect(updateCommand(false, false, services())).resolves.toBe(0);
      await expect(updateCommand(false, false, services({ isInteractive: () => true, prompt: async () => "n" }))).resolves.toBe(0);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("npm install --global"));
      expect(log).toHaveBeenCalledWith("Current version: 1.0.0");
    } finally { log.mockRestore(); error.mockRestore(); }
  });

  it("runs the public update check through the default services", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await expect(runCli(["update", "--check"])).resolves.toBe(0);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("Current version:"));
    } finally { log.mockRestore(); }
  });

  it("updates with yes and reports install/check failures", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const install = vi.fn(async () => undefined);
      let version = "1.0.0";
      await expect(updateCommand(false, true, services({ installLatest: install, currentVersion: () => version }))).resolves.toBe(1);
      version = "2.0.0";
      await expect(updateCommand(false, true, services({ installLatest: install, currentVersion: () => version }))).resolves.toBe(0);
      version = "1.0.0";
      await expect(updateCommand(false, false, services({ isInteractive: () => true, prompt: async () => "yes", installLatest: install, currentVersion: () => version }))).resolves.toBe(1);
      await expect(updateCommand(false, true, services({ latestVersion: async () => { throw new Error("offline"); } }))).resolves.toBe(1);
      await expect(updateCommand(false, true, services({ installLatest: async () => { throw new Error("denied"); } }))).resolves.toBe(1);
    } finally { log.mockRestore(); error.mockRestore(); }
  });

  it("notifies from cache and can be disabled", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-notify-"));
    const oldCacheHome = process.env.XDG_CACHE_HOME;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      process.env.XDG_CACHE_HOME = directory;
      await mkdir(join(directory, "mdi"), { recursive: true });
      await writeFile(join(directory, "mdi", "update-check.json"), JSON.stringify({ registryUrl: "https://registry.npmjs.org/%40illusions-lab%2Fmdi-cli", checkedAt: new Date().toISOString(), latestVersion: "99.0.0" }));
      delete process.env.MDI_NO_UPDATE_CHECK;
      await notifyUpdate();
      expect(error).toHaveBeenCalledWith(expect.stringContaining("99.0.0"));
      process.env.MDI_NO_UPDATE_CHECK = "1";
      error.mockClear();
      await notifyUpdate();
      expect(error).not.toHaveBeenCalled();
    } finally {
      if (oldCacheHome === undefined) delete process.env.XDG_CACHE_HOME; else process.env.XDG_CACHE_HOME = oldCacheHome;
      delete process.env.MDI_NO_UPDATE_CHECK;
      error.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });
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
        build(input, "note"),
      ]);
      expect(await readFile(outputs[0], "utf8")).toBe("題\n東京と強調。");
      expect(await readFile(outputs[1], "utf8")).toContain("{東京|とうきょう}");
      expect(await readFile(outputs[2], "utf8")).toContain("｜東京《とうきょう》");
      expect(await readFile(outputs[3], "utf8")).toContain("《《強調》》");
      expect(iconv.decode(await readFile(outputs[4]), "shift_jis")).toContain("［＃「題」は中見出し］");
      expect(await readFile(outputs[5], "utf8")).toContain("｜東京《とうきょう》");
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
      await expect(build(input, "note")).resolves.toBe(join(directory, "kitchen-sink_note.txt"));
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
        join(directory, "kitchen-sink_note.txt"),
      ]);
      const aozora = await readFile(join(directory, "kitchen-sink_aozora.txt"));
      expect(iconv.decode(aozora, "shift_jis")).toContain("｜東京《とうきょう》");
      expect(aozora.includes(Buffer.from("\r\n"))).toBe(true);
      expect(await readFile(join(directory, "kitchen-sink_note.txt"), "utf8")).toContain(
        "｜東京《とうきょう》"
      );
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

  it("writes the official platform annotations through the packaged file boundary", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-platform-contracts-"));
    try {
      const input = join(directory, "novel.mdi");
      await writeFile(
        input,
        "# {独|ひと}り寝\n\n漢字（説明）と《記号》と[[em:強調]]\n\n[[pagebreak:right]]"
      );
      const narou = await build(input, "narou");
      expect(await readFile(narou, "utf8")).toContain(
        "漢字｜（説明）と《記号》と｜強《・》｜調《・》"
      );
      const kakuyomu = await build(input, "kakuyomu");
      expect(await readFile(kakuyomu, "utf8")).toContain(
        "漢字（説明）と｜《記号》と《《強調》》"
      );
      const aozora = await build(input, "aozora");
      const decoded = iconv.decode(await readFile(aozora), "shift_jis");
      expect(decoded).toContain("｜独《ひと》り寝［＃「独り寝」は中見出し］");
      expect(decoded).toContain("［＃傍点］強調［＃傍点終わり］");
      expect(decoded).toContain("［＃改見開き］");
      expect(decoded).toContain("\r\n");
      expect(decoded.replaceAll("\r\n", "")).not.toContain("\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects characters outside the official Aozora Shift_JIS character contract", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-aozora-gaiji-"));
    try {
      const input = join(directory, "novel.mdi");
      await writeFile(input, "未定義😀");
      await expect(build(input, "aozora")).rejects.toThrow(
        "Aozora Bunko output cannot encode 😀 (U+1F600) as Shift_JIS"
      );
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

  it("writes the versioned parser IR as pretty JSON", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-json-command-"));
    try {
      const input = join(directory, "book.mdi");
      const output = join(directory, "book.json");
      await writeFile(input, "# Book\n\n本文");
      await expect(runCli(["build", input, "--to", "json"])).resolves.toBe(0);
      const result = JSON.parse(await readFile(output, "utf8"));
      expect(result.irVersion).toBe("1.0");
      expect(result.syntaxVersion).toBe("2.0");
      expect(result.document.children[0].type).toBe("heading");
      expect(result.diagnostics).toEqual([]);
      expect(await readFile(output, "utf8")).toContain("\n  \"irVersion\":");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prints help for -h and --help", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await expect(runCli(["-h"])).resolves.toBe(0);
      await expect(runCli(["build", "-h"])).resolves.toBe(0);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("mdi build <input.mdi>"));
      expect(log).toHaveBeenCalledWith(expect.stringContaining("json       Write the versioned MDI document IR"));
    } finally {
      log.mockRestore();
    }
  });

  it("prints parser warnings from check without failing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-check-command-"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const input = join(directory, "book.mdi");
      await writeFile(input, '---\nmdi: "3.0"\n---\n本文');
      await expect(runCli(["check", input])).resolves.toBe(0);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("warning: mdi.version.unsupported"));
    } finally {
      log.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("accepts --to note and writes the UTF-8 default output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-note-command-"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const input = join(directory, "book.mdi");
      const output = join(directory, "book_note.txt");
      await writeFile(input, "# 題\n\n{東京|とうきょう} **強調**");
      await expect(runCli(["build", input, "--to", "note"])).resolves.toBe(0);
      expect(log).toHaveBeenCalledWith(`Written ${output}`);
      expect(await readFile(output, "utf8")).toBe(
        "## 題\n\n｜東京《とうきょう》 **強調** "
      );
    } finally {
      log.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("returns success and reports every output written by the command adapter", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdi-cli-run-success-"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const input = join(directory, "book.mdi");
      await writeFile(input, "text");
      await expect(runCli(["build", input, "--to", "txt-all"])).resolves.toBe(0);
      expect(log).toHaveBeenCalledTimes(6);
      expect(log).toHaveBeenCalledWith(`Written ${join(directory, "book.txt")}`);
      expect(log).toHaveBeenCalledWith(`Written ${join(directory, "book_aozora.txt")}`);
      expect(log).toHaveBeenCalledWith(`Written ${join(directory, "book_note.txt")}`);
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
      ], { env: { ...process.env, MDI_NO_UPDATE_CHECK: "1" } });
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
      ], { env: { ...process.env, MDI_NO_UPDATE_CHECK: "1" } });
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
      ))
        .replace("writing-mode: horizontal", "writing-mode: vertical")
        // The Aozora contract is Shift_JIS/JIS X 0208. Keep this all-format
        // fixture inside that repertoire; the dedicated contract test above
        // verifies that unsupported literal glyphs fail instead of becoming ?.
        .replace("（既定記号 ﹅）", "（既定記号）")
        .replace("[[em:﹆:ここぞ]]", "[[em:○:ここぞ]]");
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
      expect(textOutputs).toHaveLength(6);
      expect(await readFile(join(directory, "kitchen-sink_ruby.txt"), "utf8")).toContain("{東京|とうきょう}");
      expect(
        iconv.decode(await readFile(join(directory, "kitchen-sink_aozora.txt")), "shift_jis")
      ).toContain("｜東京《とうきょう》");
      expect(await readFile(join(directory, "kitchen-sink_note.txt"), "utf8")).toContain(
        "｜東京《とうきょう》"
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
