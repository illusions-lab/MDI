import { describe, expect, it } from "vitest";
import {
  PAGE_DIMENSIONS,
  PAGE_SIZE_LABELS,
  PAGE_SIZES,
  getPageSizeLabel,
  listPageSizes,
  parseExportProfileJson,
  requireLayoutSystem,
  resolveExportProfile,
  resolvePrintProfile,
} from "./index.js";

describe("export profiles", () => {
  it("publishes complete Japanese labels and UI metadata for every paper size", () => {
    const sizes = listPageSizes();
    expect(sizes).toHaveLength(PAGE_SIZES.length);
    expect(Object.keys(PAGE_SIZE_LABELS.ja)).toHaveLength(PAGE_SIZES.length);

    for (const pageSize of PAGE_SIZES) {
      expect(PAGE_SIZE_LABELS.ja[pageSize]).toEqual(expect.any(String));
      expect(getPageSizeLabel(pageSize, "ja")).toBe(PAGE_SIZE_LABELS.ja[pageSize]);
      expect(sizes.find((size) => size.key === pageSize)).toEqual({
        key: pageSize,
        label: PAGE_SIZE_LABELS.ja[pageSize],
        widthMm: PAGE_DIMENSIONS[pageSize].width,
        heightMm: PAGE_DIMENSIONS[pageSize].height,
      });
    }
  });
  it("preserves distinct Japanese labels for A, JIS B, and ISO B families", () => {
    expect(getPageSizeLabel("A4")).toBe("A4判");
    expect(getPageSizeLabel("JIS-B5")).toBe("JIS B5判");
    expect(getPageSizeLabel("ISO-B5")).toBe("ISO B5判");
    expect(getPageSizeLabel("B5")).toBe("ISO B5判");
    expect(getPageSizeLabel("Bunko")).toBe("文庫判");
    expect(getPageSizeLabel("Ofuku-Hagaki")).toBe("往復はがき");
  });
  it("rejects unsupported runtime paper-size keys and locales", () => {
    expect(() => getPageSizeLabel("A11" as never)).toThrow("Unsupported page size or locale");
    expect(() => getPageSizeLabel("A4", "en" as never)).toThrow("Unsupported page size or locale");
    expect(() => listPageSizes({ locale: "en" as never })).toThrow("Unsupported page size or locale");
  });
  it("resolves a physically valid publisher default for every supported paper size and writing direction", () => {
    for (const pageSize of PAGE_SIZES) {
      expect(
        resolveExportProfile({ pagination: { pageSize } }).pagination.pageSize
      ).toBe(pageSize);
      const vertical = resolvePrintProfile({ pagination: { pageSize } }, "vertical");
      expect(vertical.pagination.margins.left + vertical.pagination.margins.right)
        .toBeLessThan(PAGE_DIMENSIONS[pageSize].width);
      expect(vertical.pagination.margins.top + vertical.pagination.margins.bottom)
        .toBeLessThan(PAGE_DIMENSIONS[pageSize].height);
    }
  });
  it("uses the researched four-six horizontal publisher default", () => {
    const profile = resolveExportProfile();
    expect(profile.typesetting.writingMode).toBe("horizontal");
    expect(profile.pagination).toMatchObject({
      pageSize: "Shirokuban",
      landscape: false,
      charactersPerLine: 27,
      linesPerPage: 26,
      gridMode: "strict",
      margins: { top: 16.5, bottom: 18, left: 18, right: 15.5 },
    });
    expect(profile.typesetting.fontSize).toBe(10);
  });
  it("uses the A4 landscape 40 × 30 vertical-fiction manuscript and right-bound mirror spread", () => {
    const vertical = resolvePrintProfile({}, "vertical");
    expect(vertical.typesetting).toMatchObject({ writingMode: "vertical", fontSize: 10.5 });
    expect(vertical.pagination).toMatchObject({
      pageSize: "A4", landscape: true, charactersPerLine: 40, linesPerPage: 30,
      margins: { right: 28, left: 28, top: 30.91666666666667, bottom: 30.91666666666667 },
    });
    expect(vertical.layout).toMatchObject({ marginMode: "mirror", bindingSide: "right" });
    const explicit = resolvePrintProfile(
      {
        typesetting: { writingMode: "horizontal" },
        pagination: { landscape: false },
      },
      "vertical"
    );
    expect(explicit.typesetting.writingMode).toBe("horizontal");
    expect(explicit.pagination.landscape).toBe(false);
  });
  it("keeps Word layout separate from the fixed Japanese manuscript grid", () => {
    const word = resolveExportProfile({ layout: { system: "word" } });
    expect(word.layout).toMatchObject({ system: "word", marginMode: "single" });
    expect(word.pagination).toMatchObject({
      gridMode: "typographic",
      margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
    });
    expect(() => resolveExportProfile({
      layout: { system: "word" }, pagination: { gridMode: "strict" },
    })).toThrow("flowing typography");
    expect(() => parseExportProfileJson('{"pagination":{}}'))
      .toThrow("Configured exports require layout.system");
  });
  it("requires an explicit layout system at configured-export boundaries", () => {
    expect(() =>
      requireLayoutSystem({ layout: { system: "japanese-publisher" } })
    ).not.toThrow();
    expect(() => requireLayoutSystem({})).toThrow(
      "Configured exports require layout.system"
    );
    expect(() => requireLayoutSystem(null as never)).toThrow(
      "Export profile must be an object"
    );
    expect(() => requireLayoutSystem(0 as never)).toThrow(
      "Export profile must be an object"
    );
    expect(() => requireLayoutSystem([] as never)).toThrow(
      "Export profile must be an object"
    );
  });
  it("adds a publisher gutter at the selected single-sheet binding edge", () => {
    const rightBound = resolveExportProfile({
      layout: { system: "japanese-publisher", bindingSide: "right", gutter: 6 },
      pagination: { margins: { left: 10, right: 12 } },
    });
    expect(rightBound.pagination.margins).toMatchObject({ left: 10, right: 18 });
    const leftBound = resolveExportProfile({
      layout: { system: "japanese-publisher", bindingSide: "left", gutter: 6 },
      pagination: { margins: { left: 10, right: 12 } },
    });
    expect(leftBound.pagination.margins).toMatchObject({ left: 16, right: 12 });
    expect(() => resolveExportProfile({ layout: { system: "word", gutter: 1 } }))
      .toThrow("only available with japanese-publisher");
  });
  it("derives physically valid proportional defaults for smaller and non-JIS paper", () => {
    const b6 = resolvePrintProfile({ pagination: { pageSize: "B6" } }, "vertical");
    const letter = resolvePrintProfile({ pagination: { pageSize: "Letter" } }, "horizontal");
    expect(b6.pagination).toMatchObject({ charactersPerLine: 40, linesPerPage: 26 });
    expect(b6.pagination.margins.right).toBeCloseTo(125 * 28 / 210);
    expect(letter.pagination.charactersPerLine).toBe(40);
    expect(letter.pagination.linesPerPage).toBeGreaterThanOrEqual(10);
    const a0 = resolvePrintProfile({ pagination: { pageSize: "A0" } }, "vertical");
    expect(a0.pagination.charactersPerLine).toBeGreaterThan(40);
    expect(a0.pagination.linesPerPage).toBeGreaterThan(30);
    expect(a0.pagination.margins.left).toBeLessThan(25);
  });
  it("rejects invalid values instead of silently changing print layout", () => {
    expect(() =>
      resolveExportProfile({ pagination: { pageSize: "A11" as never } })
    ).toThrow("Unsupported page size");
    expect(() =>
      resolveExportProfile({ pagination: { charactersPerLine: 9 } })
    ).toThrow("charactersPerLine");
    expect(() =>
      resolveExportProfile({ typesetting: { textIndentEm: 4.1 } })
    ).toThrow("textIndentEm");
    expect(() => resolveExportProfile({ text: { indentCount: 0 } })).toThrow(
      "text.indentCount"
    );
  });
  it("parses nested profile settings", () => {
    const profile = parseExportProfileJson(
      '{"layout":{"system":"japanese-publisher"},"typesetting":{"writingMode":"horizontal","fullwidthSpaceIndent":true},"pagination":{"pageNumbers":{"format":"fraction","position":"top-right"}},"epub":{"chapterSplitLevel":"h3"}}'
    );
    expect(profile.typesetting.writingMode).toBe("horizontal");
    expect(profile.pagination.pageNumbers).toEqual({
      enabled: true,
      format: "fraction",
      position: "top-right",
    });
    expect(profile.epub.chapterSplitLevel).toBe("h3");
  });
  it("normalizes explicit point sizes and baseline multipliers", () => {
    const profile = resolveExportProfile({
      typesetting: { fontSize: 11, lineSpacing: 1.5 },
      pagination: { gridMode: "typographic" },
    });
    expect(profile.typesetting).toMatchObject({
      fontSize: 11,
      lineSpacing: 1.5,
    });
    expect(
      resolveExportProfile({
        typesetting: { fontSizePt: 10.5, lineHeight: 1.2 },
        pagination: { gridMode: "typographic" },
      }).typesetting
    ).toMatchObject({ fontSize: 10.5, lineSpacing: 1.2 });
    expect(resolveExportProfile().typesetting.fontSize).toBe(10);
    expect(resolveExportProfile().typesetting.lineSpacing).toBeUndefined();
  });
  it("does not silently break a strict publisher grid", () => {
    expect(() =>
      resolveExportProfile({ typesetting: { lineSpacing: 1.5 } })
    ).toThrow("gridMode: typographic");
    expect(
      resolveExportProfile({
        pagination: { gridMode: "typographic", charactersPerLine: 32, linesPerPage: 28 },
        typesetting: { fontSize: 11, lineSpacing: 1.4 },
      }).pagination
    ).toMatchObject({ gridMode: "typographic", charactersPerLine: 32, linesPerPage: 28 });
  });
  it("rejects malformed profiles", () => {
    expect(() => parseExportProfileJson("[]")).toThrow("JSON object");
    expect(() => parseExportProfileJson("{")).toThrow("valid JSON");
    expect(() => parseExportProfileJson(null as never)).toThrow(
      "source must be a string"
    );
    expect(() => resolvePrintProfile(null as never)).toThrow(
      "Export profile must be an object"
    );
    expect(() => resolvePrintProfile(0 as never)).toThrow(
      "Export profile must be an object"
    );
    expect(() => resolvePrintProfile([] as never)).toThrow(
      "Export profile must be an object"
    );
  });
  it("rejects runtime JSON values with the wrong primitive type", () => {
    expect(() =>
      parseExportProfileJson('{"layout":{"system":"word"},"pagination":{"landscape":"yes"}}')
    ).toThrow("landscape must be a boolean");
    expect(() => parseExportProfileJson('{"layout":{"system":"word"},"metadata":{"title":42}}')).toThrow(
      "metadata.title must be a string"
    );
    expect(() =>
      parseExportProfileJson('{"layout":{"system":"word"},"pagination":{"margins":[]}}')
    ).toThrow("pagination.margins must be an object");
  });
  it("rejects every invalid structured profile option", () => {
    expect(() => resolveExportProfile(null as never)).toThrow(
      "Export profile must be an object"
    );
    expect(() => resolveExportProfile({ typesetting: [] as never })).toThrow(
      "typesetting must be an object"
    );
    expect(() => resolveExportProfile({ metadata: { author: 1 } as never })).toThrow(
      "metadata.author must be a string"
    );
    expect(() => resolveExportProfile({ typesetting: { fontFamily: 1 as never } })).toThrow(
      "fontFamily must be a string"
    );
    expect(() => resolveExportProfile({ typesetting: { fontSize: 3 } })).toThrow(
      "fontSize"
    );
    expect(() => resolveExportProfile({ typesetting: { lineSpacing: 4 } })).toThrow(
      "lineSpacing"
    );
    expect(() => resolveExportProfile({ pagination: { gridMode: "flexible" as never } })).toThrow(
      "gridMode"
    );
    expect(() => resolveExportProfile({ typesetting: { fontSize: 11, fontSizePt: 12 } })).toThrow(
      "fontSize and fontSizePt"
    );
    expect(() => resolveExportProfile({
      typesetting: { lineSpacing: 1.2, lineHeight: 1.5 },
      pagination: { gridMode: "typographic" },
    })).toThrow("lineSpacing and lineHeight");
    expect(() => resolveExportProfile({ epub: { coverPath: 1 as never } })).toThrow(
      "coverPath must be a string"
    );
    expect(() => resolveExportProfile({ typesetting: { writingMode: "sideways" as never } })).toThrow(
      "writingMode must be vertical or horizontal"
    );
    expect(() => resolveExportProfile({ epub: { chapterSplitLevel: "h4" as never } })).toThrow(
      "chapterSplitLevel must be h1, h2, h3, or none"
    );
    expect(() => resolveExportProfile({ pagination: { pageNumbers: { format: "roman" as never } } })).toThrow(
      "Unsupported page number format"
    );
    expect(() => resolveExportProfile({ pagination: { pageNumbers: { position: "middle" as never } } })).toThrow(
      "Unsupported page number position"
    );
  });
  it("covers explicit geometry, optional metadata, and all printable-area guards", () => {
    const resolved = resolveExportProfile({
      layout: { system: "japanese-publisher", marginMode: "single", bindingSide: "right" },
      typesetting: { fontFamily: "   " },
      pagination: { landscape: true, pageNumbers: { enabled: false } },
      epub: { coverPath: "cover.png" },
    });
    expect(resolved.pagination.landscape).toBe(true);
    expect(resolved.pagination.pageNumbers.enabled).toBe(false);
    expect(resolved.epub.coverPath).toBe("cover.png");
    expect(resolved.typesetting.fontFamily).toContain("Yu Mincho");
    expect(() => resolveExportProfile({ pagination: { pageNumbers: { enabled: "yes" as never } } }))
      .toThrow("pageNumbers.enabled must be a boolean");
    expect(() => resolveExportProfile({ pagination: { margins: { left: 100, right: 100 } } }))
      .toThrow("left and right margins");
    expect(() => resolveExportProfile({ pagination: { margins: { top: 100, bottom: 100 } } }))
      .toThrow("top and bottom margins");
  });
});
