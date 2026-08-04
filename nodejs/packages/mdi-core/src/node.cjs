// Node wasm-pack bindings instantiate synchronously at module evaluation.
// This explicit CommonJS facade avoids Node's ambiguous-module warning while
// preserving the generated Node loader's require/fs behavior.
const bindings = require("../generated/node/mdi_core.js");

class MdiCoreNotInitializedError extends Error {}
const initialization = Promise.resolve();

exports.MdiCoreNotInitializedError = MdiCoreNotInitializedError;
exports.initializeMdiCore = () => initialization;
exports.applyPdfProfileJson = bindings.applyPdfProfileJson;
exports.blockMacroAmount = bindings.blockMacroAmount;
exports.blockMacroKind = bindings.blockMacroKind;
exports.blockMacroVariant = bindings.blockMacroVariant;
exports.pageSizeCatalogJson = bindings.pageSizeCatalogJson;
exports.getMdiTextBlocksJson = bindings.getMdiTextBlocksJson;
exports.parseMdiSyntaxJson = bindings.parseMdiSyntaxJson;
exports.prepareChromiumPrintProfileJson = bindings.prepareChromiumPrintProfileJson;
exports.renderDocx = bindings.renderDocx;
exports.renderDocxWithProfile = bindings.renderDocxWithProfile;
exports.renderEpub = bindings.renderEpub;
exports.renderEpubWithProfile = bindings.renderEpubWithProfile;
exports.renderHtml = bindings.renderHtml;
exports.renderText = bindings.renderText;
exports.renderTextFormat = bindings.renderTextFormat;
exports.resolveExportProfileJson = bindings.resolveExportProfileJson;
exports.resolveRuby = bindings.resolveRuby;
exports.serializeMdi = bindings.serializeMdi;
exports.unescapeMdi = bindings.unescapeMdi;
exports.unescapeRubyText = bindings.unescapeRubyText;
