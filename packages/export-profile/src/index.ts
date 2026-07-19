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
  metadata?: ExportMetadata;
  typesetting?: {
    writingMode?: WritingMode;
    fontFamily?: string;
    textIndentEm?: number;
    fullwidthSpaceIndent?: boolean;
  };
  pagination?: {
    pageSize?: PageSize;
    landscape?: boolean;
    charactersPerLine?: number;
    linesPerPage?: number;
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
  metadata: ExportMetadata;
  typesetting: Required<NonNullable<ExportProfile["typesetting"]>>;
  pagination: {
    pageSize: PageSize;
    landscape: boolean;
    charactersPerLine: number;
    linesPerPage: number;
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

export const DEFAULT_EXPORT_PROFILE: ResolvedExportProfile = {
  metadata: {},
  typesetting: {
    writingMode: "horizontal",
    fontFamily: "serif",
    textIndentEm: 1,
    fullwidthSpaceIndent: false,
  },
  pagination: {
    pageSize: "A4",
    landscape: false,
    charactersPerLine: 40,
    linesPerPage: 34,
    // Match Word's Normal preset: one inch on all sides.
    margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
    pageNumbers: { enabled: true, format: "simple", position: "bottom-center" },
  },
  epub: { chapterSplitLevel: "h1" },
  text: { fullwidthSpaceIndent: false, indentCount: 1 },
};

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
  requireObject(profile.epub, "epub");
  requireObject(profile.text, "text");
  requireObject(profile.metadata, "metadata");
  const typesetting = profile.typesetting ?? {};
  const pagination = profile.pagination ?? {};
  const text = profile.text ?? {};
  requireObject(pagination.pageNumbers, "pagination.pageNumbers");
  requireObject(pagination.margins, "pagination.margins");
  const pageNumbers = pagination.pageNumbers ?? {};
  const margins = pagination.margins ?? {};
  const pageSize =
    pagination.pageSize ?? DEFAULT_EXPORT_PROFILE.pagination.pageSize;
  for (const [key, value] of Object.entries(profile.metadata ?? {}))
    if (value !== undefined && typeof value !== "string")
      throw new Error(`metadata.${key} must be a string`);
  if (
    typesetting.fontFamily !== undefined &&
    typeof typesetting.fontFamily !== "string"
  )
    throw new Error("fontFamily must be a string");
  if (
    profile.epub?.coverPath !== undefined &&
    typeof profile.epub.coverPath !== "string"
  )
    throw new Error("coverPath must be a string");
  if (typeof pageSize !== "string" || !(pageSize in PAGE_DIMENSIONS))
    throw new Error(`Unsupported page size: ${String(pageSize)}`);
  if (
    typesetting.writingMode !== undefined &&
    typesetting.writingMode !== "vertical" &&
    typesetting.writingMode !== "horizontal"
  )
    throw new Error("writingMode must be vertical or horizontal");
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
  const resolvedMargins: Margins = {
    top: number(
      margins.top,
      DEFAULT_EXPORT_PROFILE.pagination.margins.top,
      0,
      50,
      "top margin"
    ),
    bottom: number(
      margins.bottom,
      DEFAULT_EXPORT_PROFILE.pagination.margins.bottom,
      0,
      50,
      "bottom margin"
    ),
    left: number(
      margins.left,
      DEFAULT_EXPORT_PROFILE.pagination.margins.left,
      0,
      50,
      "left margin"
    ),
    right: number(
      margins.right,
      DEFAULT_EXPORT_PROFILE.pagination.margins.right,
      0,
      50,
      "right margin"
    ),
  };
  return {
    metadata: { ...profile.metadata },
    typesetting: {
      writingMode:
        typesetting.writingMode ??
        DEFAULT_EXPORT_PROFILE.typesetting.writingMode,
      fontFamily:
        typesetting.fontFamily?.trim() ||
        DEFAULT_EXPORT_PROFILE.typesetting.fontFamily,
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
      landscape: boolean(
        pagination.landscape,
        DEFAULT_EXPORT_PROFILE.pagination.landscape,
        "landscape"
      ),
      charactersPerLine: number(
        pagination.charactersPerLine,
        DEFAULT_EXPORT_PROFILE.pagination.charactersPerLine,
        10,
        60,
        "charactersPerLine"
      ),
      linesPerPage: number(
        pagination.linesPerPage,
        DEFAULT_EXPORT_PROFILE.pagination.linesPerPage,
        10,
        50,
        "linesPerPage"
      ),
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
 * explicit export profile always wins. Vertical Japanese composition defaults
 * to landscape paper so the default character grid remains readable.
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
    pagination: {
      ...profile?.pagination,
      landscape: profile?.pagination?.landscape ?? writingMode === "vertical",
    },
  });
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
  return resolveExportProfile(raw as ExportProfile);
}
