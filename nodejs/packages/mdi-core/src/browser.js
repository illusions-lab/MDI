// The wasm-pack output is deliberately private.  This module is the stable
// browser boundary: it owns initialization and makes the precondition for all
// synchronous Rust calls explicit.
import * as bindings from "../generated/web/mdi_core.js";
import { createMdiCoreRuntime, MdiCoreNotInitializedError } from "./runtime.js";

export { MdiCoreNotInitializedError };
const runtime = createMdiCoreRuntime(() => bindings.default());

export function initializeMdiCore() {
  return runtime.initialize();
}

function requireInitialized() {
  runtime.requireInitialized();
}

export const applyPdfProfileJson = (...args) => (requireInitialized(), bindings.applyPdfProfileJson(...args));
export const blockMacroAmount = (...args) => (requireInitialized(), bindings.blockMacroAmount(...args));
export const blockMacroKind = (...args) => (requireInitialized(), bindings.blockMacroKind(...args));
export const blockMacroVariant = (...args) => (requireInitialized(), bindings.blockMacroVariant(...args));
export const pageSizeCatalogJson = (...args) => (requireInitialized(), bindings.pageSizeCatalogJson(...args));
export const getMdiTextBlocksJson = (...args) => (requireInitialized(), bindings.getMdiTextBlocksJson(...args));
export const resolveMdiSourceSpanJson = (...args) => (requireInitialized(), bindings.resolveMdiSourceSpanJson(...args));
export const parseMdiSyntaxJson = (...args) => (requireInitialized(), bindings.parseMdiSyntaxJson(...args));
export const prepareChromiumPrintProfileJson = (...args) => (requireInitialized(), bindings.prepareChromiumPrintProfileJson(...args));
export const renderDocx = (...args) => (requireInitialized(), bindings.renderDocx(...args));
export const renderDocxWithProfile = (...args) => (requireInitialized(), bindings.renderDocxWithProfile(...args));
export const renderEpub = (...args) => (requireInitialized(), bindings.renderEpub(...args));
export const renderEpubWithProfile = (...args) => (requireInitialized(), bindings.renderEpubWithProfile(...args));
export const renderHtml = (...args) => (requireInitialized(), bindings.renderHtml(...args));
export const renderText = (...args) => (requireInitialized(), bindings.renderText(...args));
export const renderTextFormat = (...args) => (requireInitialized(), bindings.renderTextFormat(...args));
export const resolveExportProfileJson = (...args) => (requireInitialized(), bindings.resolveExportProfileJson(...args));
export const resolveRuby = (...args) => (requireInitialized(), bindings.resolveRuby(...args));
export const serializeMdi = (...args) => (requireInitialized(), bindings.serializeMdi(...args));
export const unescapeMdi = (...args) => (requireInitialized(), bindings.unescapeMdi(...args));
export const unescapeRubyText = (...args) => (requireInitialized(), bindings.unescapeRubyText(...args));
