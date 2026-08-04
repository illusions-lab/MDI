import { resolveExportProfileJson as resolveProfileInRust } from "@illusions-lab/mdi-core";

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
export type LayoutSystem = "japanese-publisher" | "word";
export type MarginMode = "single" | "mirror";
export type BindingSide = "right" | "left";
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
  layout?: {
    system?: LayoutSystem;
    marginMode?: MarginMode;
    bindingSide?: BindingSide;
    gutter?: number;
  };
  metadata?: ExportMetadata;
  typesetting?: {
    writingMode?: WritingMode;
    fontFamily?: string;
    fontSize?: number;
    /** @deprecated Use fontSize. */
    fontSizePt?: number;
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
    fontSize: number;
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

export type PageSize = keyof typeof PAGE_SIZE_LABELS.ja;

interface RustPageSizeDimensions {
  key: PageSize;
  widthMm: number;
  heightMm: number;
}

/**
 * A generated snapshot of config/publication-layouts.yaml.  It intentionally
 * avoids a WASM call during module evaluation, so importing this package is
 * safe before a browser application awaits initializeMdiCore().  The
 * publication contract test compares it with the Rust catalogue.
 */
export const PAGE_DIMENSIONS = {
  A0:{width:841,height:1189},A1:{width:594,height:841},A2:{width:420,height:594},A3:{width:297,height:420},A4:{width:210,height:297},A5:{width:148,height:210},A6:{width:105,height:148},A7:{width:74,height:105},A8:{width:52,height:74},A9:{width:37,height:52},A10:{width:26,height:37},
  "JIS-B0":{width:1030,height:1456},"JIS-B1":{width:728,height:1030},"JIS-B2":{width:515,height:728},"JIS-B3":{width:364,height:515},"JIS-B4":{width:257,height:364},"JIS-B5":{width:182,height:257},"JIS-B6":{width:128,height:182},"JIS-B7":{width:91,height:128},"JIS-B8":{width:64,height:91},"JIS-B9":{width:45,height:64},"JIS-B10":{width:32,height:45},
  "ISO-B0":{width:1000,height:1414},"ISO-B1":{width:707,height:1000},"ISO-B2":{width:500,height:707},"ISO-B3":{width:353,height:500},"ISO-B4":{width:250,height:353},"ISO-B5":{width:176,height:250},"ISO-B6":{width:125,height:176},"ISO-B7":{width:88,height:125},"ISO-B8":{width:62,height:88},"ISO-B9":{width:44,height:62},"ISO-B10":{width:31,height:44},
  Bunko:{width:105,height:148},Shinsho:{width:103,height:182},Shirokuban:{width:127,height:188},Kikuban:{width:150,height:220},"A5-ban":{width:148,height:210},"B6-ban":{width:128,height:182},"AB-ban":{width:210,height:257},"Ju-ban":{width:182,height:206},"Kiku-tate":{width:152,height:218},Tankobon:{width:130,height:188},
  Letter:{width:216,height:279},Legal:{width:216,height:356},Tabloid:{width:279,height:432},Executive:{width:184,height:267},Statement:{width:140,height:216},Folio:{width:210,height:330},Quarto:{width:203,height:254},"10x14":{width:254,height:356},
  "Naga-3":{width:120,height:235},"Naga-4":{width:90,height:205},"Kaku-2":{width:240,height:332},"Kaku-3":{width:216,height:277},"Kaku-6":{width:162,height:229},"Kaku-8":{width:119,height:197},"You-4":{width:105,height:235},"You-6":{width:98,height:190},Hagaki:{width:100,height:148},"Ofuku-Hagaki":{width:200,height:148},"L-ban":{width:89,height:127},"2L-ban":{width:127,height:178},KG:{width:102,height:152},Cabinet:{width:130,height:180},B5:{width:176,height:250},B6:{width:125,height:176},
} as const satisfies Record<PageSize, { width: number; height: number }>;

export const PAGE_SIZES = Object.keys(PAGE_DIMENSIONS) as PageSize[];

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
} as const;

export type PageSizeLocale = keyof typeof PAGE_SIZE_LABELS;

export interface PageSizeMetadata {
  key: PageSize;
  label: string;
  widthMm: number;
  heightMm: number;
}

export function getPageSizeLabel(
  pageSize: PageSize,
  locale: PageSizeLocale = "ja",
): string {
  const label = PAGE_SIZE_LABELS[locale]?.[pageSize];
  if (typeof label !== "string")
    throw new Error(`Unsupported page size or locale: ${String(pageSize)}, ${String(locale)}`);
  return label;
}

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

function resolveInRust(
  profile: ExportProfile,
  sourceWritingMode: unknown,
  requireLayout: boolean,
): ResolvedExportProfile {
  const mode = sourceWritingMode === "vertical" ? "vertical" : undefined;
  return JSON.parse(
    resolveProfileInRust(JSON.stringify(profile), mode, requireLayout),
  ) as ResolvedExportProfile;
}

/** Validate and fill a profile through the language-neutral Rust authority. */
export function resolveExportProfile(
  profile: ExportProfile = {},
): ResolvedExportProfile {
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    throw new Error("Export profile must be an object");
  return resolveInRust(profile, undefined, false);
}

/** Apply source writing mode only when the explicit profile does not override it. */
export function resolvePrintProfile(
  profile: ExportProfile | undefined,
  sourceWritingMode?: unknown,
): ResolvedExportProfile {
  if (profile !== undefined && (!profile || typeof profile !== "object" || Array.isArray(profile)))
    throw new Error("Export profile must be an object");
  return resolveInRust(profile ?? {}, sourceWritingMode, false);
}

/** Require an explicit layout system at a configured-export boundary. */
export function requireLayoutSystem(profile: ExportProfile): void {
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    throw new Error("Export profile must be an object");
  resolveInRust(profile, undefined, true);
}

/** Parse and resolve a CLI JSON profile through Rust. */
export function parseExportProfileJson(source: string): ResolvedExportProfile {
  if (typeof source !== "string") throw new TypeError("source must be a string");
  return JSON.parse(resolveProfileInRust(source, undefined, true)) as ResolvedExportProfile;
}

export const DEFAULT_EXPORT_PROFILE: ResolvedExportProfile = resolveExportProfile();
