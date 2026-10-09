import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { renderHtml } from "@illusions-lab/mdi";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdi from "@illusions-lab/mdi-remark";
import { resolveExportProfile } from "@illusions-lab/mdi-export-profile";
import type { Root } from "mdast";
import { applyPdfProfile, mdiToPdf, renderHtmlToPdf } from "./index.js";
import { prepareChromiumPrintProfile } from "./profile.js";

describe("mdiToPdf", () =>
  it("generates a browser-rendered PDF", async () => {
    const p = unified().use(remarkParse).use(remarkMdi);
    const tree = p.runSync(
      p.parse("---\nwriting-mode: vertical\n---\n{東京|とうきょう}")
    ) as Root;
    const pdf = await mdiToPdf(tree);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  }, 30_000));

describe("mdiToPdf edge cases", () => {
  it("renders plain Markdown and can be called repeatedly", async () => {
    const p = unified().use(remarkParse).use(remarkMdi);
    const tree = p.runSync(
      p.parse("# Plain heading\n\nA regular paragraph.")
    ) as Root;
    const [first, second] = await Promise.all([mdiToPdf(tree), mdiToPdf(tree)]);

    for (const pdf of [first, second]) {
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(500);
    }
  }, 30_000);
});

const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("self-contained PDF resources", () => {
  it("embeds a data-url image and rejects network or file requests", async () => {
    const pdf = await renderHtmlToPdf(
      `<html><head></head><body><a href="https://example.com/page">page</a><img src="data:image/png;base64,${onePixelPng}" width="1" height="1"></body></html>`,
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("/Image");

    const blocked = await renderHtmlToPdf(
      '<html><head></head><body><img src="http://alice:s3cret-token@127.0.0.1:9/secret.png"></body></html>',
      undefined,
      undefined,
      { deadlineMs: 15_000 },
    ).then(() => "", (error: Error) => error.message);
    expect(blocked).toContain("PDF export blocked a resource request");
    expect(blocked).not.toMatch(/s3cret-token/);

    await expect(renderHtmlToPdf(
      '<html><head></head><body><img src="file:///etc/passwd"></body></html>',
      undefined,
      undefined,
      { deadlineMs: 15_000 },
    )).rejects.toThrow("PDF export blocked a resource request");
  }, 60_000);

  it("closes Chromium when the export exceeds its deadline", async () => {
    await expect(renderHtmlToPdf(
      "<html><head></head><body><p>timeout</p></body></html>",
      undefined,
      undefined,
      { deadlineMs: 1 },
    )).rejects.toThrow("PDF export timed out");
  }, 30_000);

  it("rejects file and nested SVG resources before launch, and does not wait on a hung launch", async () => {
    let launched = false;
    const launchBrowser = () => {
      launched = true;
      return new Promise<never>(() => undefined);
    };
    await expect(renderHtmlToPdf(
      '<html><head></head><body><img src="file:///etc/passwd"></body></html>',
      undefined,
      undefined,
      { deadlineMs: 1_000, launchBrowser },
    )).rejects.toThrow("PDF export blocked a resource request: file:///etc/passwd");
    const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://alice:s3cret-token@example.test/a.png"/></svg>');
    const nested = await renderHtmlToPdf(
      `<html><head></head><body><img src="data:image/svg+xml,${svg}"></body></html>`,
      undefined,
      undefined,
      { deadlineMs: 1_000, launchBrowser },
    ).then(() => "", (error: Error) => error.message);
    expect(nested).toContain("PDF export blocked a resource request");
    expect(nested).not.toMatch(/s3cret-token|alice/);
    expect(launched).toBe(false);

    await expect(renderHtmlToPdf(
      "<html><head></head><body><p>hung</p></body></html>",
      undefined,
      undefined,
      { deadlineMs: 30, launchBrowser: () => new Promise(() => undefined) },
    )).rejects.toThrow("PDF export timed out");
  });

  it("rejects a deadline that is not a positive number before launch", async () => {
    for (const deadlineMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      let launched = false;
      await expect(renderHtmlToPdf("<html></html>", undefined, undefined, {
        deadlineMs,
        launchBrowser: () => {
          launched = true;
          return new Promise(() => undefined);
        },
      })).rejects.toThrow(new RangeError("deadlineMs must be a positive number"));
      expect(launched).toBe(false);
    }
  });

  it("rejects subresources before Chromium launches", async () => {
    const secret = "https://alice:s3cret@example.test/a.png";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><image href="${secret}"/></svg>`;
    const spaced = Buffer.from(svg).toString("base64").replace(/(.{8})/g, "$1\n");
    let nested = "data:image/svg+xml,%3Csvg%3E%3C/svg%3E";
    for (let depth = 0; depth < 4; depth += 1) {
      nested = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><image href="${nested}"/></svg>`)}`;
    }
    const blocked = [
      `<div style="background:url(${secret})"></div>`,
      `<div style="background: url( '${secret}' )"></div>`,
      `<style>body{background:url(${secret})}</style>`,
      `<style>@import "${secret}";</style>`,
      `<style>@import '${secret}';</style>`,
      `<style>@import "${secret}</style>`,
      `<style>url(https://example.test/a.png)@import "${secret}";</style>`,
      `<style>url('${secret}</style>`,
      `<img srcset="data:image/png;base64,${onePixelPng} 1x, ${secret} 2x">`,
      `<iframe srcdoc="<img src='${secret}'>"></iframe>`,
      `<script src="${secret}"></script>`,
      `<link href="${secret}">`,
      `<video src="${secret}"></video>`,
      `<audio src="${secret}"></audio>`,
      `<source src="${secret}">`,
      `<embed src="${secret}">`,
      `<object data="${secret}"></object>`,
      `<svg><use href="${secret}"></use></svg>`,
      `<svg:image href="${secret}"></svg:image>`,
      `<img src="images/a.png">`,
      `<img src="//alice:s3cret@assets.example/a.png">`,
      `<img src="data:image/png;base64">`,
      `<img src="data:image/svg+xml;base64,%%%%">`,
      `<img src="data:image/svg+xml,%">`,
      `<img src="data:image/svg+xml;base64,${spaced}">`,
      `<img src="${nested}">`,
      `<img src="http&#58;//example.test/a.png">`,
      `<img src="http&#x3a;//example.test/a.png">`,
      `<img src=https://example.test/a.png>`,
      `<img src="https://example.test/a.png" alt>`,
      `<img src="http://alice:s3cret@exa mple/a.png">`,
      `<img src="//alice:s3cret@exa mple/a.png">`,
      `<img src="http://exa mple/a.png">`,
      `<img srcset="https://example.test/a.png 1x,">`,
      `<img @ src="${secret}">`,
      `<img src="data:image/svg+xml,${encodeURIComponent('<img src="https://example.test/a.png"')}">`,
    ];
    for (const body of blocked) {
      const message = await rejectionBeforeLaunch(`<html><body>${body}</body></html>`);
      expect(message).toContain("PDF export blocked a resource request");
      expect(message).not.toMatch(/alice|s3cret/);
    }
  });

  it("prints markup that cannot fetch a subresource", async () => {
    const { browser, record } = pdfPageDouble({
      duringSetContent: (fire) => fire("about:blank", true),
    });
    const pdf = await renderHtmlToPdf(
      `<html><body>
        <!-- <img src="https://example.test/secret.png"> -->
        <!DOCTYPE html><?xml version="1.0"?><p></p>
        <@ href="https://example.test/not-a-tag.png">
        <img src="#fragment">
        <img src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"></svg> tail')}">
        <img src="data:image/svg+xml,${encodeURIComponent("<!DOCTYPE html")}">
        <img src="data:image/svg+xml,${encodeURIComponent("<img ")}">
        <img src="data:image/svg+xml,${encodeURIComponent("<style>a</style")}">
        <img srcset="data:image/png;base64,${onePixelPng} 1x,">
        <script>url(https://example.test/a.png)</script>
        <style>body{color:black}@import nope;</style>
        <style>url(</style>
        <abbr title="&#x110000;&#9999999999;">x</abbr>
        <style>color:red
        <img src="data:image/svg+xml,${encodeURIComponent("<!-- <img src=\"https://example.test/unclosed.png\">")}">
      </body></html>`,
      undefined,
      undefined,
      { deadlineMs: 1_000, launchBrowser: async () => browser },
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(record.pdf).toBe(true);
    expect(record.continued).toEqual(["about:blank"]);
  });

  it("aborts a non-navigation request and a request that arrives during printing", async () => {
    const duringLoad = pdfPageDouble({
      duringSetContent: async (fire) => {
        await fire("about:blank", true);
        await fire("https://example.test/late.png", false);
      },
    });
    const loaded = await renderHtmlToPdf("<html><body><p>clean</p></body></html>", undefined, undefined, {
      deadlineMs: 1_000,
      launchBrowser: async () => duringLoad.browser,
    }).then(() => "", (error: Error) => error.message);
    expect(loaded).toContain("PDF export blocked a resource request: https://example.test/late.png");
    expect(duringLoad.record.continued).toEqual(["about:blank"]);
    expect(duringLoad.record.aborted).toEqual(["blockedbyclient"]);
    expect(duringLoad.record.pdf).toBe(false);

    const duringPrint = pdfPageDouble({
      duringSetContent: (fire) => fire("about:blank", true),
      duringPdf: (fire) => fire("https://alice:s3cret@example.test/late.png", false),
    });
    const printed = await renderHtmlToPdf("<html><body><p>clean</p></body></html>", undefined, undefined, {
      deadlineMs: 1_000,
      launchBrowser: async () => duringPrint.browser,
    }).then(() => "", (error: Error) => error.message);
    expect(printed).toContain("PDF export blocked a resource request");
    expect(printed).not.toMatch(/alice|s3cret/);
    expect(duringPrint.record.pdf).toBe(true);
    expect(duringPrint.record.aborted).toEqual(["blockedbyclient"]);
  });

  it("returns once the launched browser process has exited", async () => {
    const child = spawn(process.execPath, ["-e", "setTimeout(() => process.exit(0), 100)"]);
    const pid = child.pid;
    if (pid === undefined) throw new Error("browser process has no pid");
    try {
      const { browser, record } = pdfPageDouble({
        duringSetContent: (fire) => fire("about:blank", true),
      }, pid);
      const pdf = await renderHtmlToPdf("<html><body><p>clean</p></body></html>", undefined, undefined, {
        deadlineMs: 1_000,
        launchBrowser: async () => browser,
      });
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(record.pdf).toBe(true);
    } finally {
      child.kill();
    }
  });
});

function rejectionBeforeLaunch(html: string): Promise<string> {
  let launched = false;
  return renderHtmlToPdf(html, undefined, undefined, {
    deadlineMs: 1_000,
    launchBrowser: () => {
      launched = true;
      return new Promise(() => undefined);
    },
  }).then(() => {
    throw new Error("export succeeded");
  }, (error: Error) => {
    expect(launched).toBe(false);
    return error.message;
  });
}

function pdfPageDouble(hooks: {
  duringSetContent?: (fire: (url: string, navigation: boolean) => Promise<void>) => Promise<void> | void;
  duringPdf?: (fire: (url: string, navigation: boolean) => Promise<void>) => Promise<void> | void;
}, pid?: number): { browser: Browser; record: { continued: string[]; aborted: string[]; pdf: boolean } } {
  const frame = {};
  const record = { continued: [] as string[], aborted: [] as string[], pdf: false };
  let onRequest: ((request: { url(): string; isNavigationRequest(): boolean; frame(): object }) => void) | undefined;
  let onRoute: ((route: {
    request(): { url(): string; isNavigationRequest(): boolean; frame(): object };
    continue(): Promise<void>;
    abort(errorCode: string): Promise<void>;
  }) => Promise<void>) | undefined;
  const fire = async (url: string, navigation: boolean) => {
    const request = {
      url: () => url,
      isNavigationRequest: () => navigation,
      frame: () => frame,
    };
    onRequest?.(request);
    if (!onRoute) return;
    let action = "";
    await onRoute({
      request: () => request,
      continue: async () => { action = "continue"; },
      abort: async (errorCode: string) => { action = errorCode; },
    });
    if (action === "continue") record.continued.push(url);
    else if (action) record.aborted.push(action);
  };
  const page = {
    setDefaultTimeout() {},
    mainFrame: () => frame,
    context: () => ({ setOffline: async () => undefined }),
    on(event: string, handler: NonNullable<typeof onRequest>) {
      if (event === "request") onRequest = handler;
    },
    async route(_pattern: string, handler: NonNullable<typeof onRoute>) {
      onRoute = handler;
    },
    async setContent() {
      await hooks.duringSetContent?.(fire);
    },
    async emulateMedia() {},
    async evaluate(code: string) {
      if (code.includes("document.body,undefined")) return [];
      return undefined;
    },
    async pdf() {
      await hooks.duringPdf?.(fire);
      record.pdf = true;
      return Buffer.from("%PDF-1.4\n");
    },
  };
  const browser = {
    async newPage() { return page; },
    async close() {},
    process: () => (pid === undefined ? null : { pid }),
  };
  return { browser: browser as unknown as Browser, record };
}

describe("renderHtmlToPdf", () =>
  it("acts as a Chromium-only layout adapter for Rust-owned HTML", async () => {
    const pdf = await renderHtmlToPdf(
      "<html><head></head><body><h1>Rust HTML</h1><p>東京</p></body></html>",
      undefined,
      "vertical"
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  }, 30_000));

describe("PDF page-number layout", () => {
  const profile = (format: "simple" | "dash" | "fraction", position: "top-left" | "bottom-right") => ({
    layout: { system: "japanese-publisher" as const, marginMode: "single" as const, bindingSide: "left" as const, gutter: 0 },
    metadata: {},
    typesetting: { writingMode: "horizontal" as const, fontFamily: "serif", textIndentEm: 1, fullwidthSpaceIndent: false },
    pagination: {
      pageSize: "A4" as const,
      landscape: false,
      charactersPerLine: 40,
      linesPerPage: 30,
      gridMode: "strict" as const,
      margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
      pageNumbers: { enabled: true, format, position },
    },
    epub: { chapterSplitLevel: "h1" as const },
    text: { fullwidthSpaceIndent: false, indentCount: 1 },
  });

  it.each([
    ["dash", "top-left"],
    ["fraction", "bottom-right"],
  ] as const)("renders %s numbering at %s", async (format, position) => {
    const pdf = await renderHtmlToPdf(
      "<html><head></head><body><p>numbered</p></body></html>",
      profile(format, position),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});

describe("browser-safe Chromium print profile", () => {
  it("keeps the Playwright adapter and browser hosts on identical CSS", () => {
    const html = "<html><head></head><body><p>本文</p></body></html>";
    const profile = {
      layout: { system: "japanese-publisher" as const },
      typesetting: { writingMode: "vertical" as const },
      pagination: {
        pageSize: "A4" as const,
        landscape: true,
        pageNumbers: { enabled: true, format: "fraction" as const, position: "top-right" as const },
      },
    };
    const prepared = prepareChromiumPrintProfile(html, profile);

    expect(prepared.html).toBe(applyPdfProfile(html, prepared.profile));
    expect(prepared.page).toMatchObject({ widthMm: 297, heightMm: 210, landscape: true });
    expect(prepared.pageNumbers.headerTemplate).toContain('text-align:right');
    expect(prepared.pageNumbers.headerTemplate).toContain('class="totalPages"');
    expect(prepared.pageNumbers.footerTemplate).toBeUndefined();
  });

  it("uses source writing mode and exposes footer metadata without launching Chromium", () => {
    const prepared = prepareChromiumPrintProfile("<p>縦書き</p>", undefined, "vertical");

    expect(prepared.html).toContain('<style id="mdi-export-profile">');
    expect(prepared.html).toContain("writing-mode:vertical-rl");
    expect(prepared.page).toMatchObject({ widthMm: 297, heightMm: 210, landscape: true });
    expect(prepared.pageNumbers).toMatchObject({ enabled: true, position: "bottom-center" });
    expect(prepared.pageNumbers.headerTemplate).toBeUndefined();
    expect(prepared.pageNumbers.footerTemplate).toContain('class="pageNumber"');
  });

  it("keeps browser-safe input validation and creates no header/footer for disabled numbering", () => {
    expect(() => prepareChromiumPrintProfile(null as never)).toThrow("html must be a string");
    for (const profile of [null, 1, []]) {
      expect(() =>
        prepareChromiumPrintProfile("<p>本文</p>", profile as never)
      ).toThrow("profile must be an object");
    }
    expect(() => applyPdfProfile(null as never, resolveExportProfile())).toThrow(
      "html must be a string",
    );
    const prepared = prepareChromiumPrintProfile(
      "<html><body><p>本文</p></body></html>",
      {
        layout: { system: "word" },
        pagination: { pageNumbers: { enabled: false } },
      },
    );
    expect(prepared.html).toContain("<head><style id=\"mdi-export-profile\">");
    expect(prepared.pageNumbers.headerTemplate).toBeUndefined();
    expect(prepared.pageNumbers.footerTemplate).toBeUndefined();
  });
});

describe("vertical Chromium syntax layout", () => {
  it("keeps documented blank syntax as one strict-grid column", async () => {
    const html = renderHtml(`---
writing-mode: vertical
---

前の段落です。

\\

<br>

<br />

[[blank]]

後の段落です。`);
    const prepared = prepareChromiumPrintProfile(html, {
      layout: { system: "japanese-publisher" },
      typesetting: { writingMode: "vertical" },
    }, "vertical");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(prepared.html);
      const blankColumns = await page.locator(".mdi-blank").evaluateAll((blanks) =>
        blanks.map((blank) => {
          const style = blank.ownerDocument.defaultView!.getComputedStyle(blank);
          return {
            blockSize: blank.getBoundingClientRect().width,
            minimumBlockSize: Number.parseFloat(style.minBlockSize),
            lineHeight: Number.parseFloat(style.lineHeight),
          };
        }),
      );
      expect(blankColumns).toHaveLength(4);
      for (const column of blankColumns) {
        expect(column.minimumBlockSize).toBeGreaterThan(0);
        expect(column.blockSize).toBeCloseTo(column.lineHeight, 2);
        expect(column.blockSize).toBeCloseTo(column.minimumBlockSize, 2);
      }
    } finally {
      await browser.close();
    }
  }, 30_000);
});

describe("PDF export profile", () => {
  it("uses the researched four-six horizontal publisher baseline", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile()
    );
    expect(html).toContain("@page{size:127mm 188mm");
    expect(html).toContain("@page{size:127mm 188mm;margin:16.5mm 15.5mm 18mm 18mm}");
    expect(html).toContain("@page :right{margin:16.5mm 18mm 18mm 15.5mm}");
    expect(html).toContain("@page :left{margin:16.5mm 15.5mm 18mm 18mm}");
    expect(html).not.toContain("body{padding:");
    expect(html).toContain("html{writing-mode:horizontal-tb!important");
    expect(html).not.toContain("p+h1,p+h2,p+h3,p+h4,p+h5,p+h6{padding-top:.75em}");
  });
  it("applies margins through @page so every forced page receives them", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>first</p><div class=\"mdi-pagebreak\"></div><p>second</p></body></html>",
      resolveExportProfile()
    );
    expect(html).toContain("@page{size:127mm 188mm;margin:16.5mm 15.5mm 18mm 18mm}");
    expect(html).toContain("mdi-pagebreak");
    expect(html).not.toContain("padding:20mm");
  });
  it("applies geometry, composition, full-width indentation, and page options", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      {
        layout: { system: "japanese-publisher", marginMode: "mirror", bindingSide: "right", gutter: 0 },
        metadata: {},
        typesetting: {
          writingMode: "vertical",
          fontFamily: "Noto Serif JP",
          fontSize: 10.5,
          textIndentEm: 2,
          fullwidthSpaceIndent: true,
        },
        pagination: {
          pageSize: "A4",
          landscape: false,
          charactersPerLine: 40,
          linesPerPage: 30,
          gridMode: "strict",
          margins: { top: 34, bottom: 28, left: 28, right: 45 },
          pageNumbers: {
            enabled: true,
            format: "fraction",
            position: "bottom-center",
          },
        },
        epub: { chapterSplitLevel: "h1" },
        text: { fullwidthSpaceIndent: false, indentCount: 1 },
      }
    );
    expect(html).toContain("@page{size:210mm 297mm");
    expect(html).toContain("writing-mode:vertical-rl");
    expect(html).toContain("font-family:Noto Serif JP");
    expect(html).toContain("<p>　　本文");
  });
  it("uses physical CJK grid CSS by default", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile()
    );
    expect(html).toContain("--mdi-grid-mode:strict");
    expect(html).toContain("--mdi-characters-per-line:27");
    expect(html).toContain("--mdi-lines-per-page:26");
    expect(html).toMatch(/line-height:5\.903846153846154mm/);
    expect(html).toContain("p{margin:0;text-indent:1em}");
  });
  it("uses the resolved inline pitch for a right-bound vertical manuscript", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile({
        layout: { system: "japanese-publisher" },
        typesetting: { writingMode: "vertical" },
      })
    );
    expect(html).toContain("writing-mode:vertical-rl");
    expect(html).toContain("@page{size:297mm 210mm");
    expect(html).toMatch(/--mdi-character-pitch:3\.70416666666666\d*mm/);
    expect(html).toContain("letter-spacing:0mm");
  });
  it("supports landscape typographic composition without an explicit leading multiplier", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile({
        layout: { system: "japanese-publisher" },
        typesetting: { fullwidthSpaceIndent: true, textIndentEm: 2 },
        pagination: { pageSize: "A4", landscape: true, gridMode: "typographic" },
      })
    );
    expect(html).toContain("@page{size:297mm 210mm");
    expect(html).toContain("writing-mode:horizontal-tb");
    expect(html).toContain("<p>　　本文");
    expect(html).toContain("p{margin:0 0 .75em;text-indent:0}");
  });
  it("uses explicit point size and line spacing only in typographic mode", () => {
    const html = applyPdfProfile(
      "<html><head></head><body><p>本文</p></body></html>",
      resolveExportProfile({
        layout: { system: "word" },
        typesetting: { fontSize: 12, lineSpacing: 1.5 },
        pagination: { gridMode: "typographic", charactersPerLine: 60, linesPerPage: 50 },
      })
    );
    expect(html).toMatch(/font-size:4\.23\d+mm;line-height:1\.5/);
    expect(html).toContain("line-height:1.5");
  });
});

it('prints a long formatted warichu only after host-driven layout converges', async()=>{
 const html=renderHtml(`前文（[[warichu:${'一二三四五六七八九十'.repeat(15)}[[br]][[br]]{東京|とうきょう}]]）後文`);
 const pdf=await renderHtmlToPdf(html);
 expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
 expect(pdf.length).toBeGreaterThan(500);
},30000);
