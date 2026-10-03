import {
  applyPdfProfileJson,
  prepareChromiumPrintProfileJson,
} from "@illusions-lab/mdi-core";
import type {
  ExportProfile,
  ResolvedExportProfile,
} from "@illusions-lab/mdi-export-profile";

export interface ChromiumPrintPageNumber {
  enabled: boolean;
  format: ResolvedExportProfile["pagination"]["pageNumbers"]["format"];
  position: ResolvedExportProfile["pagination"]["pageNumbers"]["position"];
  headerTemplate?: string;
  footerTemplate?: string;
}

/**
 * Browser-safe print data produced by the language-neutral Rust core.
 * JavaScript hosts only use these values to call their browser PDF API.
 */
export interface ChromiumPrintProfile {
  html: string;
  profile: ResolvedExportProfile;
  page: {
    widthMm: number;
    heightMm: number;
    marginsMm: ResolvedExportProfile["pagination"]["margins"];
    landscape: boolean;
  };
  pageNumbers: ChromiumPrintPageNumber;
}

export function prepareChromiumPrintProfile(
  html: string,
  profile?: ExportProfile,
  sourceWritingMode?: unknown,
): ChromiumPrintProfile {
  if (typeof html !== "string") throw new TypeError("html must be a string");
  if (profile !== undefined && (
    !profile ||
    typeof profile !== "object" ||
    Array.isArray(profile)
  ))
    throw new TypeError("profile must be an object");
  const mode = sourceWritingMode === "vertical" ? "vertical" : undefined;
  return JSON.parse(
    prepareChromiumPrintProfileJson(
      html,
      JSON.stringify(profile ?? {}),
      mode,
    ),
  ) as ChromiumPrintProfile;
}

export function applyPdfProfile(
  html: string,
  profile: ResolvedExportProfile,
): string {
  if (typeof html !== "string") throw new TypeError("html must be a string");
  return applyPdfProfileJson(html, JSON.stringify(profile));
}
