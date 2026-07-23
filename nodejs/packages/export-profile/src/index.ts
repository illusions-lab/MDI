export type WritingMode = "vertical" | "horizontal";
export type PageNumberFormat = "simple" | "dash" | "fraction";
export type PageNumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";
export type ChapterSplitLevel = "h1" | "h2" | "h3" | "none";
/** Two intentionally incompatible page-composition contracts. */
export type LayoutSystem = "japanese-publisher" | "word";
/** Single-sheet manuscript pages or mirrored book spreads. */
export type MarginMode = "single" | "mirror";
/** The physical binding side for a single-sheet manuscript. */
export type BindingSide = "right" | "left";
/**
 * `strict` makes the character and line counts the physical page contract.
 * `typographic` instead lets a line-spacing multiplier determine the block
 * pitch. A strict grid may still set a font size: that controls glyph size
 * inside each fixed manuscript cell, not the cell geometry.
 */
export type GridMode = "strict" | "typographic";

export interface Margins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ExportMetadata {
  title?: string;
  author?: string;
  publisher?: string;
  identifier?: string;
  language?: string;
  date?: string;
}

export interface ExportProfile {
  /**
   * Select one composition contract for configured publication exports.
   * `japanese-publisher` preserves a characters × lines grid; `word` uses
   * Word Normal-style page margins and flowing paragraphs.
   */
  layout?: {
    system?: LayoutSystem;
    marginMode?: MarginMode;
    bindingSide?: BindingSide;
    /** Extra binding allowance in millimetres; only for publisher layout. */
    gutter?: number;
  };
  metadata?: ExportMetadata;
  typesetting?: {
    writingMode?: WritingMode;
    fontFamily?: string;
    /** Body type size in points. In a strict grid this does not alter cell pitch. */
    fontSize?: number;
    /** @deprecated Use fontSize. Kept for JSON profiles written before 2.1. */
    fontSizePt?: number;
    /** Baseline multiplier; only available with `pagination.gridMode: "typographic"`. */
    lineSpacing?: number;
    /** @deprecated Use lineSpacing. */
    lineHeight?: number;
    textIndentEm?: number;
    fullwidthSpaceIndent?: boolean;
  };
  pagination?: {
    pageSize?: PageSize;
    landscape?: boolean;
    charactersPerLine?: number;
    linesPerPage?: number;
    /**
     * Publisher manuscript grid policy. In strict mode, a point size or
     * line-spacing override is rejected rather than silently changing the
     * promised characters × lines page.
     */
    gridMode?: GridMode;
    margins?: Partial<Margins>;
    pageNumbers?: {
      enabled?: boolean;
      format?: PageNumberFormat;
      position?: PageNumberPosition;
    };
  };
  epub?: {
    chapterSplitLevel?: ChapterSplitLevel;
    /** A JSON config path; the CLI loads it as JPEG or PNG. */
    coverPath?: string;
  };
  text?: {
    fullwidthSpaceIndent?: boolean;
    indentCount?: number;
  };
}

export interface ResolvedExportProfile {
  layout: {
    system: LayoutSystem;
    marginMode: MarginMode;
    bindingSide: BindingSide;
    gutter: number;
  };
  metadata: ExportMetadata;
  typesetting: {
    writingMode: WritingMode;
    fontFamily: string;
    /** Explicit body size in points in typographic mode; undefined preserves the grid. */
    fontSize?: number;
    /** Explicit baseline multiplier in typographic mode; undefined preserves the grid. */
    lineSpacing?: number;
    textIndentEm: number;
    fullwidthSpaceIndent: boolean;
  };
  pagination: {
    pageSize: PageSize;
    landscape: boolean;
    charactersPerLine: number;
    linesPerPage: number;
    gridMode: GridMode;
    margins: Margins;
    pageNumbers: {
      enabled: boolean;
      format: PageNumberFormat;
      position: PageNumberPosition;
    };
  };
  epub: { chapterSplitLevel: ChapterSplitLevel; coverPath?: string };
  text: { fullwidthSpaceIndent: boolean; indentCount: number };
}

export const PAGE_DIMENSIONS = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  A7: { width: 74, height: 105 },
  A8: { width: 52, height: 74 },
  A9: { width: 37, height: 52 },
  A10: { width: 26, height: 37 },
  "JIS-B0": { width: 1030, height: 1456 },
  "JIS-B1": { width: 728, height: 1030 },
  "JIS-B2": { width: 515, height: 728 },
  "JIS-B3": { width: 364, height: 515 },
  "JIS-B4": { width: 257, height: 364 },
  "JIS-B5": { width: 182, height: 257 },
  "JIS-B6": { width: 128, height: 182 },
  "JIS-B7": { width: 91, height: 128 },
  "JIS-B8": { width: 64, height: 91 },
  "JIS-B9": { width: 45, height: 64 },
  "JIS-B10": { width: 32, height: 45 },
  "ISO-B0": { width: 1000, height: 1414 },
  "ISO-B1": { width: 707, height: 1000 },
  "ISO-B2": { width: 500, height: 707 },
  "ISO-B3": { width: 353, height: 500 },
  "ISO-B4": { width: 250, height: 353 },
  "ISO-B5": { width: 176, height: 250 },
  "ISO-B6": { width: 125, height: 176 },
  "ISO-B7": { width: 88, height: 125 },
  "ISO-B8": { width: 62, height: 88 },
  "ISO-B9": { width: 44, height: 62 },
  "ISO-B10": { width: 31, height: 44 },
  Bunko: { width: 105, height: 148 },
  Shinsho: { width: 103, height: 182 },
  Shirokuban: { width: 127, height: 188 },
  Kikuban: { width: 150, height: 220 },
  "A5-ban": { width: 148, height: 210 },
  "B6-ban": { width: 128, height: 182 },
  "AB-ban": { width: 210, height: 257 },
  "Ju-ban": { width: 182, height: 206 },
  "Kiku-tate": { width: 152, height: 218 },
  Tankobon: { width: 130, height: 188 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
  Executive: { width: 184, height: 267 },
  Statement: { width: 140, height: 216 },
  Folio: { width: 210, height: 330 },
  Quarto: { width: 203, height: 254 },
  "10x14": { width: 254, height: 356 },
  "Naga-3": { width: 120, height: 235 },
  "Naga-4": { width: 90, height: 205 },
  "Kaku-2": { width: 240, height: 332 },
  "Kaku-3": { width: 216, height: 277 },
  "Kaku-6": { width: 162, height: 229 },
  "Kaku-8": { width: 119, height: 197 },
  "You-4": { width: 105, height: 235 },
  "You-6": { width: 98, height: 190 },
  Hagaki: { width: 100, height: 148 },
  "Ofuku-Hagaki": { width: 200, height: 148 },
  "L-ban": { width: 89, height: 127 },
  "2L-ban": { width: 127, height: 178 },
  KG: { width: 102, height: 152 },
  Cabinet: { width: 130, height: 180 },
  B5: { width: 176, height: 250 },
  B6: { width: 125, height: 176 },
} as const;

export type PageSize = keyof typeof PAGE_DIMENSIONS;
export const PAGE_SIZES = Object.keys(PAGE_DIMENSIONS) as PageSize[];

/** Localized display names for the shared paper-size catalogue. */
export const PAGE_SIZE_LABELS = {
  ja: {
    A0: "A0判", A1: "A1判", A2: "A2判", A3: "A3判", A4: "A4判",
    A5: "A5判", A6: "A6判", A7: "A7判", A8: "A8判", A9: "A9判", A10: "A10判",
    "JIS-B0": "JIS B0判", "JIS-B1": "JIS B1判", "JIS-B2": "JIS B2判",
    "JIS-B3": "JIS B3判", "JIS-B4": "JIS B4判", "JIS-B5": "JIS B5判",
    "JIS-B6": "JIS B6判", "JIS-B7": "JIS B7判", "JIS-B8": "JIS B8判",
    "JIS-B9": "JIS B9判", "JIS-B10": "JIS B10判",
    "ISO-B0": "ISO B0判", "ISO-B1": "ISO B1判", "ISO-B2": "ISO B2判",
    "ISO-B3": "ISO B3判", "ISO-B4": "ISO B4判", "ISO-B5": "ISO B5判",
    "ISO-B6": "ISO B6判", "ISO-B7": "ISO B7判", "ISO-B8": "ISO B8判",
    "ISO-B9": "ISO B9判", "ISO-B10": "ISO B10判",
    Bunko: "文庫判", Shinsho: "新書判", Shirokuban: "四六判", Kikuban: "菊判",
    "A5-ban": "A5判", "B6-ban": "B6判", "AB-ban": "AB判", "Ju-ban": "十六判",
    "Kiku-tate": "菊判縦", Tankobon: "単行本判",
    Letter: "レター", Legal: "リーガル", Tabloid: "タブロイド", Executive: "エグゼクティブ",
    Statement: "ステートメント", Folio: "フォリオ", Quarto: "クォート", "10x14": "10 × 14インチ",
    "Naga-3": "長形3号", "Naga-4": "長形4号", "Kaku-2": "角形2号", "Kaku-3": "角形3号",
    "Kaku-6": "角形6号", "Kaku-8": "角形8号", "You-4": "洋形4号", "You-6": "洋形6号",
    Hagaki: "はがき", "Ofuku-Hagaki": "往復はがき", "L-ban": "L判", "2L-ban": "2L判",
    KG: "KG判", Cabinet: "キャビネ判", B5: "ISO B5判", B6: "ISO B6判",
  },
} as const satisfies { ja: Record<PageSize, string> };

export type PageSizeLocale = keyof typeof PAGE_SIZE_LABELS;

/** UI-ready metadata for one paper size in a requested locale. */
export interface PageSizeMetadata {
  key: PageSize;
  label: string;
  widthMm: number;
  heightMm: number;
}

/** Return the localized UI label for a supported paper-size key. */
export function getPageSizeLabel(
  pageSize: PageSize,
  locale: PageSizeLocale = "ja",
): string {
  const labels = PAGE_SIZE_LABELS[locale];
  const label = labels?.[pageSize];
  if (typeof label !== "string")
    throw new Error(`Unsupported page size or locale: ${String(pageSize)}, ${String(locale)}`);
  return label;
}

/** List every paper size with a localized label and physical millimetre dimensions. */
export function listPageSizes(
  options: { locale?: PageSizeLocale } = {},
): PageSizeMetadata[] {
  const locale = options.locale ?? "ja";
  return PAGE_SIZES.map((key) => ({
    key,
    label: getPageSizeLabel(key, locale),
    widthMm: PAGE_DIMENSIONS[key].width,
    heightMm: PAGE_DIMENSIONS[key].height,
  }));
}

export const DEFAULT_EXPORT_PROFILE: ResolvedExportProfile = {
  layout: {
    system: "japanese-publisher",
    marginMode: "mirror",
    bindingSide: "left",
    gutter: 0,
  },
  metadata: {},
  typesetting: {
    writingMode: "horizontal",
    fontFamily: "Yu Mincho, Hiragino Mincho ProN, Noto Serif JP, serif",
    fontSize: 10.5,
    lineSpacing: undefined,
    textIndentEm: 1,
    fullwidthSpaceIndent: false,
  },
  pagination: {
    pageSize: "Shirokuban",
    landscape: false,
    // Japanese publisher horizontal default: 14Q, 27 characters × 26 lines.
    charactersPerLine: 27,
    linesPerPage: 26,
    gridMode: "strict",
    // Four-six book layout: node 18 / head 16.5 / fore edge 15.5 / tail 18 mm.
    margins: { top: 16.5, bottom: 18, left: 18, right: 15.5 },
    pageNumbers: { enabled: true, format: "simple", position: "bottom-center" },
  },
  epub: { chapterSplitLevel: "h1" },
  text: { fullwidthSpaceIndent: false, indentCount: 1 },
};

const PUBLISHING_FONT_FAMILY = "Yu Mincho, Hiragino Mincho ProN, Noto Serif JP, serif";
const PUBLISHING_FONT_SIZE_PT = 10.5;
const MM_PER_POINT = 25.4 / 72;

/**
 * Derive a physically valid manuscript grid for every declared paper size.
 * A4 deliberately resolves to the publisher presets. Smaller sheets reduce
 * the count; larger sheets extend it. In both cases, a 10.5 pt Mincho glyph
 * and a practical outer margin are retained rather than creating a giant
 * empty page or an overflowing printable box.
 */
function publisherDefaults(
  pageSize: PageSize,
  writingMode: WritingMode,
  landscape: boolean,
  bindingSide: BindingSide,
) {
  const dimensions = PAGE_DIMENSIONS[pageSize];
  const width = landscape ? dimensions.height : dimensions.width;
  const height = landscape ? dimensions.width : dimensions.height;
  const baseGlyph = PUBLISHING_FONT_SIZE_PT * MM_PER_POINT;
  const minimumOuter = Math.min(18, Math.min(width, height) * 0.085);
  // A4 and smaller retain conventional manuscript counts. Larger sheets use
  // the same physical type size and expand their grid instead of gaining an
  // implausibly large field of white space.
  const expandsBeyondA4 = width * height > 210 * 297;
  const maximumCharacters = expandsBeyondA4 ? 400 : 40;

  // The published four-six standard (14Q) is the common book default. It is
  // intentionally separate from A4 newcomer-award manuscript presets.
  if (pageSize === "Shirokuban" && !landscape) {
    const node = 18;
    const foreEdge = 15.5;
    const margins = {
      top: 16.5,
      bottom: 18,
      left: bindingSide === "left" ? node : foreEdge,
      right: bindingSide === "right" ? node : foreEdge,
    };
    return writingMode === "vertical"
      ? {
          fontFamily: PUBLISHING_FONT_FAMILY,
          fontSize: 10,
          pageSize,
          landscape,
          charactersPerLine: 40,
          linesPerPage: 15,
          margins,
        }
      : {
          fontFamily: PUBLISHING_FONT_FAMILY,
          fontSize: 10,
          pageSize,
          landscape,
          charactersPerLine: 27,
          linesPerPage: 26,
          margins,
        };
  }

  // Japanese fiction manuscripts conventionally use A4 landscape for vertical
  // writing: 40 characters down × 30 columns across.  The 10.5 pt Mincho
  // glyph pitch fixes the 40-character inline extent; 28 mm at the right is
  // reserved for right-side binding, with a matching practical fore edge.
  if (pageSize === "A4" && landscape && writingMode === "vertical") {
    return {
      fontFamily: PUBLISHING_FONT_FAMILY,
      fontSize: PUBLISHING_FONT_SIZE_PT,
      pageSize,
      landscape,
      charactersPerLine: 40,
      linesPerPage: 30,
      margins: {
        top: 30.91666666666667,
        bottom: 30.91666666666667,
        left: 28,
        right: 28,
      },
    };
  }

  if (writingMode === "vertical") {
    // Scale the A4 28 mm binding allowance with the page width, but keep an
    // outside margin so a small book remains physically readable.
    const binding = Math.min(width * 0.22, Math.max(8, width * (28 / 210)));
    const characters = Math.max(10, Math.min(maximumCharacters, Math.floor((height - 2 * minimumOuter) / baseGlyph)));
    const lines = Math.max(10, Math.min(expandsBeyondA4 ? 400 : 30, Math.floor((width - binding - minimumOuter) / baseGlyph)));
    const glyph = Math.min(
      baseGlyph,
      (height - 2 * minimumOuter) / characters,
      (width - binding - minimumOuter) / lines,
    );
    return {
      fontFamily: PUBLISHING_FONT_FAMILY,
      fontSize: glyph / MM_PER_POINT,
      pageSize,
      landscape,
      charactersPerLine: characters,
      linesPerPage: lines,
      margins: {
        top: (height - characters * glyph) / 2,
        bottom: (height - characters * glyph) / 2,
        left: bindingSide === "left" ? binding : width - binding - lines * glyph,
        right: bindingSide === "right" ? binding : width - binding - lines * glyph,
      },
    };
  }

  const characters = Math.max(10, Math.min(maximumCharacters, Math.floor((width - 2 * minimumOuter) / baseGlyph)));
  const glyph = Math.min(baseGlyph, (width - 2 * minimumOuter) / characters);
  const horizontalMargin = (width - characters * glyph) / 2;
  const verticalMargin = Math.max(6, Math.min(20, height * 0.1));
  const lines = Math.max(10, Math.min(expandsBeyondA4 ? 400 : 50, Math.floor((height - 2 * verticalMargin) / (glyph * 1.5))));
  return {
    fontFamily: PUBLISHING_FONT_FAMILY,
    fontSize: glyph / MM_PER_POINT,
    pageSize,
    landscape,
    charactersPerLine: characters,
    linesPerPage: lines,
    margins: { top: verticalMargin, bottom: verticalMargin, left: horizontalMargin, right: horizontalMargin },
  };
}

/**
 * Word's Normal document uses one-inch margins. This layout deliberately
 * uses flowing typography instead of treating characters × lines as a page
 * contract; the calculated counts are informational defaults only.
 */
function wordDefaults(
  pageSize: PageSize,
  writingMode: WritingMode,
  landscape: boolean,
) {
  const dimensions = PAGE_DIMENSIONS[pageSize];
  const width = landscape ? dimensions.height : dimensions.width;
  const height = landscape ? dimensions.width : dimensions.height;
  // Retain Word Normal's full one-inch margin whenever it physically fits.
  const margin = Math.min(25.4, Math.max(6, Math.min(width, height) / 2 - 1));
  const glyph = PUBLISHING_FONT_SIZE_PT * MM_PER_POINT;
  const inlineExtent = writingMode === "vertical" ? height - 2 * margin : width - 2 * margin;
  const crossExtent = writingMode === "vertical" ? width - 2 * margin : height - 2 * margin;
  return {
    fontFamily: PUBLISHING_FONT_FAMILY,
    fontSize: PUBLISHING_FONT_SIZE_PT,
    pageSize,
    landscape,
    charactersPerLine: Math.max(10, Math.min(400, Math.floor(inlineExtent / glyph))),
    linesPerPage: Math.max(10, Math.min(400, Math.floor(crossExtent / (glyph * 1.15)))),
    margins: { top: margin, bottom: margin, left: margin, right: margin },
  };
}

/** Validates and fills an export profile without silently accepting bad layout data. */
export function resolveExportProfile(
  profile: ExportProfile = {}
): ResolvedExportProfile {
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    throw new Error("Export profile must be an object");
  for (const [key, value] of Object.entries(profile))
    if (
      value !== undefined &&
      (typeof value !== "object" || value === null || Array.isArray(value))
    )
      throw new Error(`${key} must be an object`);
  const requireObject = (value: unknown, label: string) => {
    if (
      value !== undefined &&
      (typeof value !== "object" || value === null || Array.isArray(value))
    )
      throw new Error(`${label} must be an object`);
  };
  requireObject(profile.typesetting, "typesetting");
  requireObject(profile.pagination, "pagination");
  requireObject(profile.layout, "layout");
  requireObject(profile.epub, "epub");
  requireObject(profile.text, "text");
  requireObject(profile.metadata, "metadata");
  const typesetting = profile.typesetting ?? {};
  const pagination = profile.pagination ?? {};
  const layout = profile.layout ?? {};
  const text = profile.text ?? {};
  requireObject(pagination.pageNumbers, "pagination.pageNumbers");
  requireObject(pagination.margins, "pagination.margins");
  const pageNumbers = pagination.pageNumbers ?? {};
  const margins = pagination.margins ?? {};
  const writingMode =
    typesetting.writingMode ?? DEFAULT_EXPORT_PROFILE.typesetting.writingMode;
  if (writingMode !== "vertical" && writingMode !== "horizontal")
    throw new Error("writingMode must be vertical or horizontal");
  const layoutSystem = layout.system ?? DEFAULT_EXPORT_PROFILE.layout.system;
  if (layoutSystem !== "japanese-publisher" && layoutSystem !== "word")
    throw new Error("layout.system must be japanese-publisher or word");
  const marginMode = layout.marginMode ?? (
    layoutSystem === "japanese-publisher" ? "mirror" : "single"
  );
  if (marginMode !== "single" && marginMode !== "mirror")
    throw new Error("layout.marginMode must be single or mirror");
  const bindingSide = layout.bindingSide ?? (
    layoutSystem === "japanese-publisher"
      ? writingMode === "vertical" ? "right" : "left"
      : "left"
  );
  if (bindingSide !== "right" && bindingSide !== "left")
    throw new Error("layout.bindingSide must be right or left");
  const pageSize = pagination.pageSize ?? (
    layoutSystem === "japanese-publisher"
      ? writingMode === "vertical" ? "A4" : "Shirokuban"
      : "A4"
  );
  for (const [key, value] of Object.entries(profile.metadata ?? {}))
    if (value !== undefined && typeof value !== "string")
      throw new Error(`metadata.${key} must be a string`);
  if (
    typesetting.fontFamily !== undefined &&
    typeof typesetting.fontFamily !== "string"
  )
    throw new Error("fontFamily must be a string");
  if (
    typesetting.fontSize !== undefined &&
    typesetting.fontSizePt !== undefined &&
    typesetting.fontSize !== typesetting.fontSizePt
  )
    throw new Error("fontSize and fontSizePt must match when both are set");
  if (
    typesetting.lineSpacing !== undefined &&
    typesetting.lineHeight !== undefined &&
    typesetting.lineSpacing !== typesetting.lineHeight
  )
    throw new Error("lineSpacing and lineHeight must match when both are set");
  if (
    profile.epub?.coverPath !== undefined &&
    typeof profile.epub.coverPath !== "string"
  )
    throw new Error("coverPath must be a string");
  if (typeof pageSize !== "string" || !(pageSize in PAGE_DIMENSIONS))
    throw new Error(`Unsupported page size: ${String(pageSize)}`);
  if (pagination.landscape !== undefined && typeof pagination.landscape !== "boolean")
    throw new Error("landscape must be a boolean");
  const landscape = pagination.landscape ?? (
    layoutSystem === "japanese-publisher" &&
    writingMode === "vertical" &&
    pageSize === "A4"
      ? true
      : DEFAULT_EXPORT_PROFILE.pagination.landscape
  );
  const modeDefaults = layoutSystem === "word"
    ? wordDefaults(pageSize, writingMode, landscape)
    : publisherDefaults(pageSize, writingMode, landscape, bindingSide);
  if (
    profile.epub?.chapterSplitLevel !== undefined &&
    !["h1", "h2", "h3", "none"].includes(profile.epub.chapterSplitLevel)
  )
    throw new Error("chapterSplitLevel must be h1, h2, h3, or none");
  if (
    pageNumbers.format !== undefined &&
    !["simple", "dash", "fraction"].includes(pageNumbers.format)
  )
    throw new Error("Unsupported page number format");
  if (
    pageNumbers.position !== undefined &&
    ![
      "top-left",
      "top-center",
      "top-right",
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ].includes(pageNumbers.position)
  )
    throw new Error("Unsupported page number position");
  const number = (
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
    label: string
  ) => {
    const resolved = value ?? fallback;
    if (!Number.isFinite(resolved) || resolved < min || resolved > max)
      throw new Error(`${label} must be between ${min} and ${max}`);
    return resolved;
  };
  const boolean = (
    value: boolean | undefined,
    fallback: boolean,
    label: string
  ) => {
    if (value !== undefined && typeof value !== "boolean")
      throw new Error(`${label} must be a boolean`);
    return value ?? fallback;
  };
  // Keep the shared defaults physically valid for every declared paper size,
  // including photo/card formats. A4 and larger retain the publisher baseline;
  // only an omitted margin is reduced for a smaller sheet.
  const dimensions = PAGE_DIMENSIONS[pageSize];
  const pageWidth = landscape ? dimensions.height : dimensions.width;
  const pageHeight = landscape ? dimensions.width : dimensions.height;
  const gutter = number(
    layout.gutter,
    DEFAULT_EXPORT_PROFILE.layout.gutter,
    0,
    Math.min(pageWidth, pageHeight) / 3,
    "layout.gutter"
  );
  if (layoutSystem === "word" && gutter !== 0)
    throw new Error("layout.gutter is only available with japanese-publisher layout");
  const resolvedMargins: Margins = {
    top: number(
      margins.top,
      modeDefaults.margins.top,
      0,
      pageHeight - 1,
      "top margin"
    ),
    bottom: number(
      margins.bottom,
      modeDefaults.margins.bottom,
      0,
      pageHeight - 1,
      "bottom margin"
    ),
    left: number(
      margins.left,
      modeDefaults.margins.left,
      0,
      pageWidth - 1,
      "left margin"
    ),
    right: number(
      margins.right,
      modeDefaults.margins.right,
      0,
      pageWidth - 1,
      "right margin"
    ),
  };
  if (layoutSystem === "japanese-publisher" && gutter > 0) {
    const bindingEdge = bindingSide === "right" ? "right" : "left";
    resolvedMargins[bindingEdge] += gutter;
  }
  const fontSize = typesetting.fontSize ?? typesetting.fontSizePt;
  const lineSpacing = typesetting.lineSpacing ?? typesetting.lineHeight;
  const gridMode = pagination.gridMode ?? (
    layoutSystem === "word" ? "typographic" : DEFAULT_EXPORT_PROFILE.pagination.gridMode
  );
  if (gridMode !== "strict" && gridMode !== "typographic")
    throw new Error("gridMode must be strict or typographic");
  if (layoutSystem === "word" && gridMode === "strict")
    throw new Error("layout.system: word uses flowing typography, not a strict manuscript grid");
  if (gridMode === "strict" && lineSpacing !== undefined)
    throw new Error(
      "lineSpacing requires pagination.gridMode: typographic; strict grid preserves its physical manuscript cells"
    );
  if (resolvedMargins.left + resolvedMargins.right >= pageWidth)
    throw new Error("left and right margins must leave printable page width");
  if (resolvedMargins.top + resolvedMargins.bottom >= pageHeight)
    throw new Error("top and bottom margins must leave printable page height");
  return {
    layout: {
      system: layoutSystem,
      marginMode,
      bindingSide,
      gutter,
    },
    metadata: { ...profile.metadata },
    typesetting: {
      writingMode,
      fontFamily:
        typesetting.fontFamily?.trim() ||
        modeDefaults.fontFamily,
      fontSize: number(fontSize, modeDefaults.fontSize, 4, 72, "fontSize"),
      ...(lineSpacing === undefined
        ? {}
        : {
            lineSpacing: number(lineSpacing, 0, 0.5, 3, "lineSpacing"),
          }),
      textIndentEm: number(
        typesetting.textIndentEm,
        DEFAULT_EXPORT_PROFILE.typesetting.textIndentEm,
        0,
        4,
        "textIndentEm"
      ),
      fullwidthSpaceIndent: boolean(
        typesetting.fullwidthSpaceIndent,
        DEFAULT_EXPORT_PROFILE.typesetting.fullwidthSpaceIndent,
        "fullwidthSpaceIndent"
      ),
    },
    pagination: {
      pageSize,
      landscape,
      charactersPerLine: number(
        pagination.charactersPerLine,
        modeDefaults.charactersPerLine,
        10,
        400,
        "charactersPerLine"
      ),
      linesPerPage: number(
        pagination.linesPerPage,
        modeDefaults.linesPerPage,
        10,
        400,
        "linesPerPage"
      ),
      gridMode,
      margins: resolvedMargins,
      pageNumbers: {
        enabled: boolean(
          pageNumbers.enabled,
          DEFAULT_EXPORT_PROFILE.pagination.pageNumbers.enabled,
          "pageNumbers.enabled"
        ),
        format:
          pageNumbers.format ??
          DEFAULT_EXPORT_PROFILE.pagination.pageNumbers.format,
        position:
          pageNumbers.position ??
          DEFAULT_EXPORT_PROFILE.pagination.pageNumbers.position,
      },
    },
    epub: {
      chapterSplitLevel:
        profile.epub?.chapterSplitLevel ??
        DEFAULT_EXPORT_PROFILE.epub.chapterSplitLevel,
      ...(profile.epub?.coverPath ? { coverPath: profile.epub.coverPath } : {}),
    },
    text: {
      fullwidthSpaceIndent: boolean(
        text.fullwidthSpaceIndent,
        DEFAULT_EXPORT_PROFILE.text.fullwidthSpaceIndent,
        "text.fullwidthSpaceIndent"
      ),
      indentCount: number(
        text.indentCount,
        DEFAULT_EXPORT_PROFILE.text.indentCount,
        1,
        4,
        "text.indentCount"
      ),
    },
  };
}

/**
 * Resolves the profile used for a document export.
 *
 * A document's front matter supplies the writing-mode default, while an
 * explicit export profile always wins. The publisher contract defaults to the
 * researched four-six book layout for horizontal pages (left-bound 27 × 26)
 * and the A4-landscape novel manuscript for vertical pages (right-bound
 * 40 × 30). Other declared paper sizes retain the same physical Mincho grid
 * where it fits, then derive safe counts.
 */
export function resolvePrintProfile(
  profile: ExportProfile | undefined,
  sourceWritingMode?: unknown
): ResolvedExportProfile {
  const writingMode =
    profile?.typesetting?.writingMode ??
    (sourceWritingMode === "vertical" ? "vertical" : "horizontal");
  return resolveExportProfile({
    ...profile,
    typesetting: { ...profile?.typesetting, writingMode },
    pagination: { ...profile?.pagination },
  });
}

/** Require an explicit system at a configured-export boundary. */
export function requireLayoutSystem(profile: ExportProfile): void {
  if (profile.layout?.system === undefined)
    throw new Error(
      "Configured exports require layout.system: japanese-publisher or word"
    );
}

/** Parse a JSON profile for the CLI; malformed JSON never falls back silently. */
export function parseExportProfileJson(source: string): ResolvedExportProfile {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error("Export profile must be valid JSON");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Export profile must be a JSON object");
  requireLayoutSystem(raw as ExportProfile);
  return resolveExportProfile(raw as ExportProfile);
}
