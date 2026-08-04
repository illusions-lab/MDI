export {
  applyPdfProfileJson, blockMacroAmount, blockMacroKind, blockMacroVariant,
  pageSizeCatalogJson, parseMdiSyntaxJson, prepareChromiumPrintProfileJson,
  renderDocx, renderDocxWithProfile, renderEpub, renderEpubWithProfile,
  renderHtml, renderText, renderTextFormat, resolveExportProfileJson,
  resolveRuby, serializeMdi, unescapeMdi, unescapeRubyText,
} from "../generated/web/mdi_core.js";
export type { InitInput, InitOutput, SyncInitInput } from "../generated/web/mdi_core.js";
export declare class MdiCoreNotInitializedError extends Error {}
export declare function initializeMdiCore(): Promise<void>;
