import * as mdiCore from "@illusions-lab/mdi-core";
import type { EpubCover, EpubExportOptions } from "@illusions-lab/mdi-to-epub";
import type { ExportProfile, WritingMode } from "@illusions-lab/mdi-export-profile";
import type { Root } from "mdast";
import { parse as parseYaml } from "yaml";

const {
	getMdiTextBlocksJson,
	resolveMdiSourceSpansJson,
	parseMdiMdastJson,
	parseMdiSyntaxJson,
	renderHtml: renderHtmlFromRust,
	renderEpub: renderEpubFromRust,
	renderEpubWithProfile: renderEpubWithProfileFromRust,
	renderDocx: renderDocxFromRust,
	renderDocxWithProfile: renderDocxWithProfileFromRust,
	renderText: renderTextFromRust,
	renderTextFormat: renderTextFormatFromRust,
	resolveExportProfileJson: resolveExportProfileJsonFromRust,
	serializeMdi: serializeMdiFromRust,
} = mdiCore;

/**
 * Initialize the shared MDI core runtime exactly once.
 *
 * Browser applications must await this before calling the synchronous parse
 * or serialization APIs. In Node.js the WASM binding is loaded eagerly, so
 * this remains a harmless resolved promise for portable application setup.
 */
export function initializeMdi(): Promise<void> {
	return mdiCore.initializeMdiCore();
}

function requireLayoutSystem(profile: ExportProfile): void {
	if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
		throw new Error("Export profile must be an object");
	}
	resolveExportProfileJsonFromRust(JSON.stringify(profile), undefined, true);
}

export type { EpubCover, EpubExportOptions, ExportProfile };

/**
 * Options for a configured EPUB export.  The profile controls metadata,
 * chapter splitting and typography; `cover` supplies the actual image data.
 */
export type MdiEpubExportOptions = EpubExportOptions & {
	/** Ergonomic aliases merged into `profile.metadata`. */
	title?: string;
	author?: string;
	publisher?: string;
	identifier?: string;
	language?: string;
	date?: string;
	/** Ergonomic aliases merged into `profile.typesetting` and `profile.epub`. */
	verticalWriting?: boolean;
	fontFamily?: string;
	/** Body type size in typographic points. */
	fontSize?: number;
	/** Baseline multiplier, for example 1.5 for one-and-a-half spacing. */
	lineSpacing?: number;
	textIndent?: number;
	/** Use an ideographic-space-compatible first-line indent. */
	fullwidthSpaceIndent?: boolean;
	/** EPUB has no fixed pages; use `typographic` when overriding type metrics. */
	gridMode?: "strict" | "typographic";
	chapterSplitLevel?: "h1" | "h2" | "h3" | "none";
	/** Shorthand for `cover: { data: coverImage, mediaType: coverMediaType }`. */
	coverImage?: Uint8Array;
	coverMediaType?: EpubCover["mediaType"];
};

/**
 * Profile for a configured DOCX export, including page geometry and numbering.
 */
export type MdiDocxExportProfile = ExportProfile & {
	title?: string;
	author?: string;
	publisher?: string;
	identifier?: string;
	language?: string;
	date?: string;
	verticalWriting?: boolean;
	fontFamily?: string;
	/** Body type size in typographic points. */
	fontSize?: number;
	/** Baseline multiplier, for example 1.5 for one-and-a-half spacing. */
	lineSpacing?: number;
	textIndent?: number;
	pageSize?: NonNullable<ExportProfile["pagination"]>["pageSize"];
	landscape?: boolean;
	/** `strict` enforces the character/line grid; `typographic` prioritizes explicit type metrics. */
	gridMode?: "strict" | "typographic";
	charactersPerLine?: number;
	linesPerPage?: number;
	margins?: NonNullable<NonNullable<ExportProfile["pagination"]>["margins"]>;
	/** Emit literal ideographic spaces for first-line indentation in DOCX. */
	fullwidthSpaceIndent?: boolean;
	showPageNumbers?: boolean;
	pageNumberPosition?: NonNullable<NonNullable<ExportProfile["pagination"]>["pageNumbers"]>["position"];
	pageNumberFormat?: NonNullable<NonNullable<ExportProfile["pagination"]>["pageNumbers"]>["format"];
};

/** MDI specification version implemented by this binding. */
export const MDI_SPEC_VERSION = "2.0" as const;

/** Version of the complete Rust-owned document IR. */
export const MDI_IR_VERSION = "1.0" as const;

/** Version of the Rust-owned searchable text projection. */
export const MDI_TEXT_PROJECTION_VERSION = "1.0" as const;

/** Version of Rust-owned transient mdast provenance records. */
export const MDI_MDAST_PROVENANCE_VERSION = "1.0" as const;

export interface MdiParserCapabilities {
	mdi: boolean;
	commonMark: boolean;
	gfm: boolean;
	frontMatter: boolean;
	sourceSpans: boolean;
}

export interface MdiSourceSpan {
	/** Inclusive UTF-8 byte offset. */
	startByte: number;
	/** Exclusive UTF-8 byte offset. */
	endByte: number;
}

/** A projection target assigned by Rust to a source-backed IR construct. */
export type MdiMdastProvenanceTarget =
	| { blockIndex: number; channel: "blockText"; range: MdiTextRange }
	| { blockIndex: number; channel: "annotation"; annotationIndex: number; range: MdiTextRange };

/**
 * Transient identity and projection metadata emitted by Rust for mdast
 * adapters. `construct.path` is a stable IR path for this parse result; it is
 * not a persisted document ID and must not be inferred from text or order.
 */
export interface MdiMdastProvenance {
	version: typeof MDI_MDAST_PROVENANCE_VERSION;
	construct: { path: string; type: string };
	span?: MdiSourceSpan;
	role: "container" | "textBearing";
	status: "sourceBacked" | "synthetic" | "unmapped";
	targets: MdiMdastProvenanceTarget[];
}

/** A canonical one-based `block:grapheme` text position. */
export type MdiTextPosition = `${number}:${number}`;

export interface MdiTextPositionValue {
	block: number;
	character: number;
}

export interface MdiTextRange {
	/** Inclusive. */
	start: MdiTextPosition;
	/** Exclusive. */
	end: MdiTextPosition;
}

export interface MdiTextSourceRun {
	range: MdiTextRange;
	/** One UTF-8 source boundary per grapheme, plus the final boundary. */
	sourceBoundaries: number[];
}

export interface MdiTextSourceMap {
	runs: MdiTextSourceRun[];
	synthetic: MdiTextRange[];
	unmapped: MdiTextRange[];
}

export type MdiAnnotationSourceMap = MdiTextSourceMap;

export interface MdiTextAnnotation {
	kind: "rubyReading";
	text: string;
	anchor: MdiTextRange;
	span?: MdiSourceSpan;
	sourceMap: MdiAnnotationSourceMap;
}

export interface MdiTextBlock {
	/** One-based source-order block number. */
	index: number;
	kind: "heading" | "paragraph" | "listItem" | "blockquote" | "code" | "table" | "footnote" | "html" | "other";
	text: string;
	range: MdiTextRange;
	span?: MdiSourceSpan;
	sourceMap: MdiTextSourceMap;
	annotations: MdiTextAnnotation[];
	node: MdiNode;
}

export interface MdiTextBlocksResult {
	projectionVersion: "1.0";
	positionEncoding: "unicode-grapheme-cluster-1-based";
	irVersion: typeof MDI_IR_VERSION;
	syntaxVersion: typeof MDI_SPEC_VERSION;
	capabilities: MdiParserCapabilities;
	blocks: MdiTextBlock[];
	document: MdiDocument;
	diagnostics: MdiDiagnostic[];
}

export type MdiSourceSpanCoverage = "complete" | "partial" | "none";
export type MdiSourceSpanRelation = "exact" | "overlap";

export interface MdiSourceSpanBlockTextMatch {
	kind: "blockText";
	blockIndex: number;
	range: MdiTextRange;
	relation: MdiSourceSpanRelation;
}

export interface MdiSourceSpanAnnotationMatch {
	kind: "annotation";
	blockIndex: number;
	/** Zero-based index in the containing block's annotations array. */
	annotationIndex: number;
	range: MdiTextRange;
	relation: MdiSourceSpanRelation;
}

export type MdiSourceSpanTextMatch =
	| MdiSourceSpanBlockTextMatch
	| MdiSourceSpanAnnotationMatch;

export interface MdiSourceSpanTextResolution {
	projectionVersion: "1.0";
	sourceSpan: MdiSourceSpan;
	coverage: MdiSourceSpanCoverage;
	matches: MdiSourceSpanTextMatch[];
}

export interface MdiDiagnostic {
	severity: "warning" | "error";
	code: string;
	message: string;
	span?: MdiSourceSpan;
}

export type MdiRubyReading =
	| { type: "group"; value: string }
	| { type: "split"; value: string[] };

/** A tagged CommonMark, GFM, or MDI node produced by Rust. */
export interface MdiNode {
	type: string;
	span?: MdiSourceSpan;
	/** Rust-owned, adapter-only metadata; omitted by canonical serialization. */
	mdiProvenance?: MdiMdastProvenance;
	children?: MdiNode[];
	[key: string]: unknown;
}

export interface MdiFrontmatter {
	span: MdiSourceSpan;
	raw: string;
	entries: Array<{ key: string; value: unknown }>;
}

export interface MdiDocument {
	span: MdiSourceSpan;
	frontmatter?: MdiFrontmatter;
	children: MdiNode[];
}

/** Resolved front matter attached to mdast compatibility roots. */
export interface MdiPublicationFrontmatter {
	mdi: string;
	title?: string;
	author?: string;
	lang: string;
	date?: string;
	writingMode: "horizontal" | "vertical";
	pageProgression: "ltr" | "rtl";
}

export interface MdiPublicationRoot extends Root {
	data?: Root["data"] & { frontmatter?: MdiPublicationFrontmatter };
}

/** A source-backed heading available to host navigation and chapter UIs. */
export interface MdiHeading {
	depth: 1 | 2 | 3 | 4 | 5 | 6;
	/** Plain, source-order text. Inline MDI is represented by `node` as well. */
	text: string;
	span?: MdiSourceSpan;
	/** The complete Rust-owned heading node, including inline children. */
	node: MdiNode;
}

/** HTML output controls that do not alter MDI semantics. */
export interface MdiHtmlRenderOptions {
	/** Return the semantic contents of `<body>` rather than a standalone page. */
	bodyOnly?: boolean;
}

/** A parsed document retained with renderer output for UI diagnostics. */
export interface MdiRenderResult<T> {
	output: T;
	document: MdiDocument;
	diagnostics: MdiDiagnostic[];
	headings: MdiHeading[];
}

/**
 * Versioned result returned by the Rust parser.
 *
 * Capability flags describe the grammar and source information included in
 * this complete Rust-owned document tree.
 */
export interface MdiSyntaxParseResult {
	irVersion: typeof MDI_IR_VERSION;
	syntaxVersion: typeof MDI_SPEC_VERSION;
	capabilities: MdiParserCapabilities;
	document: MdiDocument;
	diagnostics: MdiDiagnostic[];
}

/** @deprecated Use {@link MdiDocument}. */
export type MdiSyntaxDocument = MdiDocument;

/**
 * Parse the complete `.mdi` source in Rust and return the versioned
 * language-neutral document IR. JavaScript performs no grammar work.
 */
export function parse(source: string): MdiSyntaxParseResult {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	const result = JSON.parse(parseMdiSyntaxJson(source)) as MdiSyntaxParseResult;
	if (result.irVersion !== MDI_IR_VERSION) {
		throw new Error(`Unsupported MDI IR version: ${String(result.irVersion)}`);
	}
	return result;
}

/** @internal Rust-backed input for the mdast adapter; not a general IR API. */
export function parseForMdast(source: string): MdiSyntaxParseResult {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	const result = JSON.parse(parseMdiMdastJson(source)) as MdiSyntaxParseResult;
	if (result.irVersion !== MDI_IR_VERSION) {
		throw new Error(`Unsupported MDI IR version: ${String(result.irVersion)}`);
	}
	return result;
}

/**
 * Parse once in Rust and return source-order plaintext blocks, annotations,
 * and grapheme-precise UTF-8 source maps alongside the complete document IR.
 */
export function getMdiTextBlocks(source: string): MdiTextBlocksResult {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	const result = JSON.parse(getMdiTextBlocksJson(source)) as MdiTextBlocksResult;
	if (result.projectionVersion !== MDI_TEXT_PROJECTION_VERSION) {
		throw new Error(`Unsupported MDI text projection version: ${String(result.projectionVersion)}`);
	}
	return result;
}

/**
 * Resolve a half-open UTF-8 source span to all mapped canonical block and
 * annotation ranges. Mapping semantics are implemented exclusively in Rust.
 */
export function resolveMdiSourceSpan(
	source: string,
	span: MdiSourceSpan,
): MdiSourceSpanTextResolution {
	return resolveMdiSourceSpans(source, [span])[0]!;
}

/**
 * Resolve many half-open UTF-8 source spans with one Rust parse/projection.
 * The returned resolutions preserve input order.
 */
export function resolveMdiSourceSpans(
	source: string,
	spans: readonly MdiSourceSpan[],
): MdiSourceSpanTextResolution[] {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	if (!Array.isArray(spans)) throw new TypeError("spans must be an array");
	if (spans.length === 0) return [];
	const utf8 = utf8SourceBoundaries(source);
	for (const [index, span] of spans.entries()) {
		assertSourceSpanInput(span, `spans[${index}]`);
		if (span.startByte > span.endByte) {
			throw new RangeError(`spans[${index}].startByte must not exceed endByte`);
		}
		if (span.endByte > utf8.length) {
			throw new RangeError(`spans[${index}] falls outside the UTF-8 source length`);
		}
		if (!utf8.boundaries.has(span.startByte) || !utf8.boundaries.has(span.endByte)) {
			throw new RangeError(`spans[${index}] endpoints must be UTF-8 code-point boundaries`);
		}
	}
	const results = JSON.parse(
		resolveMdiSourceSpansJson(source, JSON.stringify(spans)),
	) as MdiSourceSpanTextResolution[];
	for (const result of results) {
		if (result.projectionVersion !== MDI_TEXT_PROJECTION_VERSION) {
			throw new Error(`Unsupported MDI text projection version: ${String(result.projectionVersion)}`);
		}
	}
	return results;
}

function assertSourceSpanInput(span: MdiSourceSpan, name = "span"): void {
	if (!span || typeof span !== "object" || Array.isArray(span)) {
		throw new TypeError(`${name} must be an object`);
	}
	if (typeof span.startByte !== "number" || typeof span.endByte !== "number") {
		throw new TypeError(`${name}.startByte and ${name}.endByte must be numbers`);
	}
	const isUint32 = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
	if (!isUint32(span.startByte) || !isUint32(span.endByte)) {
		throw new RangeError(`${name}.startByte and ${name}.endByte must be uint32 values`);
	}
}

function utf8SourceBoundaries(source: string): { length: number; boundaries: Set<number> } {
	let length = 0;
	const boundaries = new Set<number>([0]);
	for (const character of source) {
		const codePoint = character.codePointAt(0)!;
		length += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
		boundaries.add(length);
	}
	return { length, boundaries };
}

/** Parse and validate a canonical one-based `block:character` position. */
export function parseMdiTextPosition(position: string): MdiTextPositionValue {
	if (typeof position !== "string") throw new TypeError("position must be a string");
	const match = /^([1-9]\d*):([1-9]\d*)$/.exec(position);
	if (!match) throw new RangeError(`Invalid MDI text position: ${position}`);
	const block = Number(match[1]);
	const character = Number(match[2]);
	if (!Number.isSafeInteger(block) || !Number.isSafeInteger(character)) {
		throw new RangeError(`Invalid MDI text position: ${position}`);
	}
	return { block, character };
}

/** Format a validated one-based text position. */
export function formatMdiTextPosition(position: MdiTextPositionValue): MdiTextPosition {
	if (!position || typeof position !== "object") {
		throw new TypeError("position must be an object");
	}
	if (!isPositiveSafeInteger(position.block) || !isPositiveSafeInteger(position.character)) {
		throw new RangeError("position.block and position.character must be positive safe integers");
	}
	return `${position.block}:${position.character}`;
}

/** Format a canonical full `start-end` range such as `3:18-3:24`. */
export function formatMdiTextRange(range: MdiTextRange): string {
	if (!range || typeof range !== "object") throw new TypeError("range must be an object");
	const start = parseMdiTextPosition(range.start);
	const end = parseMdiTextPosition(range.end);
	if (start.block !== end.block || end.character < start.character) {
		throw new RangeError("range must be ordered within one text block");
	}
	return `${range.start}-${range.end}`;
}

/**
 * Resolve a text range to its source-derived UTF-8 spans. Synthetic table or
 * paragraph separators are deliberately omitted.
 */
export function sourceSpansForTextRange(
	block: MdiTextBlock,
	range: MdiTextRange,
): MdiSourceSpan[] {
	if (!block || typeof block !== "object") throw new TypeError("block must be an object");
	const start = parseMdiTextPosition(range.start);
	const end = parseMdiTextPosition(range.end);
	if (start.block !== block.index || end.block !== block.index) {
		throw new RangeError("range must belong to the supplied text block");
	}
	const blockEnd = parseMdiTextPosition(block.range.end).character;
	if (end.character < start.character || start.character < 1 || end.character > blockEnd) {
		throw new RangeError("range falls outside the supplied text block");
	}

	const spans: MdiSourceSpan[] = [];
	let previousRunEnd = 1;
	for (const run of block.sourceMap.runs) {
		const runStartPosition = parseMdiTextPosition(run.range.start);
		const runEndPosition = parseMdiTextPosition(run.range.end);
		const runStart = runStartPosition.character;
		const runEnd = runEndPosition.character;
		const invalidRange = runStartPosition.block !== block.index
			|| runEndPosition.block !== block.index
			|| runEnd < runStart
			|| runStart < previousRunEnd
			|| runEnd > blockEnd;
		const invalidBoundaries = run.sourceBoundaries.length !== runEnd - runStart + 1
			|| run.sourceBoundaries.some((boundary) => !Number.isSafeInteger(boundary) || boundary < 0)
			|| run.sourceBoundaries.some((boundary, index) => index > 0 && boundary < run.sourceBoundaries[index - 1]!)
			|| (block.span !== undefined && run.sourceBoundaries.some(
				(boundary) => boundary < block.span!.startByte || boundary > block.span!.endByte,
			));
		if (invalidRange || invalidBoundaries) {
			throw new Error("Invalid MDI text source run");
		}
		previousRunEnd = runEnd;
		const overlapStart = Math.max(start.character, runStart);
		const overlapEnd = Math.min(end.character, runEnd);
		for (let character = overlapStart; character < overlapEnd; character += 1) {
			const offset = character - runStart;
			appendMergedSourceSpan(spans, {
				startByte: run.sourceBoundaries[offset]!,
				endByte: run.sourceBoundaries[offset + 1]!,
			});
		}
	}
	return spans;
}

function appendMergedSourceSpan(spans: MdiSourceSpan[], next: MdiSourceSpan): void {
	const previous = spans.at(-1);
	if (previous?.endByte === next.startByte) {
		previous.endByte = next.endByte;
	} else {
		spans.push(next);
	}
}

function isPositiveSafeInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** Render complete `.mdi` source to standalone semantic HTML in Rust. */
export function renderHtml(source: string, options?: MdiHtmlRenderOptions): string {
	assertSource(source);
	assertHtmlOptions(options);
	const html = renderHtmlFromRust(source);
	return options?.bodyOnly ? htmlBody(html) : html;
}

/**
 * Render HTML while retaining the Rust parser result that made the semantic
 * decisions. Use this in editors: warnings and source spans remain available
 * instead of being silently discarded, and `headings` can drive navigation or
 * chapter controls without scraping generated HTML.
 *
 * The low-level Rust ABI currently accepts source for rendering, rather than a
 * serializable IR handle. This helper therefore validates with the same Rust
 * parser immediately before rendering and returns that exact parse result.
 */
export function renderHtmlWithDiagnostics(
	source: string,
	options?: MdiHtmlRenderOptions,
): MdiRenderResult<string> {
	assertSource(source);
	assertHtmlOptions(options);
	return renderWithDiagnostics(source, () => renderHtml(source, options));
}

/**
 * Parse once for a host workflow that needs stable diagnostics and source
 * spans before selecting one of the renderer APIs. The returned document is
 * Rust-owned IR and must not be mutated as an input to a renderer.
 */
export function prepareRender(source: string): MdiSyntaxParseResult {
	return parse(source);
}

/** Build a baseline EPUB 3 archive from complete source in Rust. */
export function renderEpub(source: string): Uint8Array;
/**
 * Build a profile-configured EPUB 3 archive. This overload is asynchronous
 * for backward compatibility; validation and archive generation run in Rust.
 */
export function renderEpub(
	source: string,
	options: MdiEpubExportOptions,
): Promise<Uint8Array>;
export function renderEpub(
	source: string,
	options?: MdiEpubExportOptions,
): Uint8Array | Promise<Uint8Array> {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	if (options !== undefined) {
		assertEpubOptions(options);
		return renderEpubWithProfile(source, options);
	}
	return renderEpubFromRust(source);
}

/** Build a baseline Rust EPUB while retaining diagnostics for an export UI. */
export function renderEpubWithDiagnostics(source: string): MdiRenderResult<Uint8Array>;
export function renderEpubWithDiagnostics(
	source: string,
	options: MdiEpubExportOptions,
): Promise<MdiRenderResult<Uint8Array>>;
export function renderEpubWithDiagnostics(
	source: string,
	options?: MdiEpubExportOptions,
): MdiRenderResult<Uint8Array> | Promise<MdiRenderResult<Uint8Array>> {
	return options === undefined
		? renderWithDiagnostics(source, () => renderEpub(source))
		: renderWithDiagnosticsAsync(source, () => renderEpub(source, options));
}

/** Build a baseline DOCX archive from complete source in Rust. */
export function renderDocx(source: string): Uint8Array;
/**
 * Build a profile-configured DOCX archive. This overload is asynchronous
 * for backward compatibility; validation and OOXML generation run in Rust.
 */
export function renderDocx(
	source: string,
	profile: MdiDocxExportProfile,
): Promise<Uint8Array>;
export function renderDocx(
	source: string,
	profile?: MdiDocxExportProfile,
): Uint8Array | Promise<Uint8Array> {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	if (profile !== undefined) {
		assertPlainObject(profile, "profile");
		return renderDocxWithProfile(source, profile);
	}
	return renderDocxFromRust(source);
}

/** Build a baseline Rust DOCX while retaining diagnostics for an export UI. */
export function renderDocxWithDiagnostics(source: string): MdiRenderResult<Uint8Array>;
export function renderDocxWithDiagnostics(
	source: string,
	profile: MdiDocxExportProfile,
): Promise<MdiRenderResult<Uint8Array>>;
export function renderDocxWithDiagnostics(
	source: string,
	profile?: MdiDocxExportProfile,
): MdiRenderResult<Uint8Array> | Promise<MdiRenderResult<Uint8Array>> {
	return profile === undefined
		? renderWithDiagnostics(source, () => renderDocx(source))
		: renderWithDiagnosticsAsync(source, () => renderDocx(source, profile));
}

/**
 * Build a configured EPUB in Rust. Unlike the one-argument
 * {@link renderEpub}, this returns a Promise for API compatibility and
 * supports cover art, metadata, chapters and vertical writing.
 */
export async function renderEpubWithProfile(
	source: string,
	options: MdiEpubExportOptions = {},
): Promise<Uint8Array> {
	assertSource(source);
	assertEpubOptions(options);
	const normalized = normalizeEpubOptions(options);
	requireLayoutSystem(normalized.profile!);
	const cover = normalized.cover;
	return renderEpubWithProfileFromRust(
		source,
		JSON.stringify(normalized.profile),
		cover?.data ?? new Uint8Array(),
		cover?.mediaType,
	);
}

/**
 * Build a configured DOCX in Rust using the shared print profile. The profile
 * supports metadata, writing mode, paper size, margins and page numbers.
 */
export async function renderDocxWithProfile(
	source: string,
	profile: MdiDocxExportProfile = {},
): Promise<Uint8Array> {
	assertSource(source);
	assertPlainObject(profile, "profile");
	const normalized = normalizeDocxProfile(profile);
	requireLayoutSystem(normalized);
	return renderDocxWithProfileFromRust(source, JSON.stringify(normalized));
}

/**
 * Convert a Rust-owned MDI document IR into mdast for unified compatibility
 * workflows. This performs no parsing and preserves the established mdast
 * node conventions.
 */
export function toPublicationMdast(document: MdiDocument): MdiPublicationRoot {
	const children = document.children.map(toPublicationMdastNode) as unknown as Root["children"];
	const tree = { type: "root", children } as MdiPublicationRoot;
	if (document.frontmatter) {
		children.unshift({ type: "yaml", value: document.frontmatter.raw } as Root["children"][number]);
		const frontmatter = publicationFrontmatter(document.frontmatter.raw);
		(tree.data ??= {} as Root["data"]) as Record<string, unknown>;
		(tree.data as Record<string, unknown>).frontmatter = frontmatter;
	}
	return tree;
}

function toPublicationMdastNode(node: MdiNode): Record<string, unknown> {
	const { span: _span, children, ...rest } = node;
	const mapped: Record<string, unknown> = { ...rest };
	if (children) mapped.children = children.map(toPublicationMdastNode);
	switch (node.type) {
		case "ruby": {
			const ruby = node.ruby as { value: string | string[] };
			return { ...mapped, type: "mdiRuby", ruby: ruby.value };
		}
		case "tcy": return { ...mapped, type: "mdiTcy" };
		case "break": return { ...mapped, type: "mdiBreak" };
		case "em": return { ...mapped, type: "mdiEm" };
		case "noBreak": return { ...mapped, type: "mdiNoBreak" };
		case "warichu": return { ...mapped, type: "mdiWarichu" };
		case "kern": return { ...mapped, type: "mdiKern" };
		case "blank": return { ...mapped, type: "mdiBlank" };
		case "pagebreak": {
			if (mapped.variant === null) delete mapped.variant;
			return { ...mapped, type: "mdiPagebreak" };
		}
		case "paragraph": {
			const data: Record<string, unknown> = {};
			if (typeof mapped.indent === "number") data.mdiIndent = mapped.indent;
			if (typeof mapped.bottom === "number") data.mdiBottom = mapped.bottom;
			delete mapped.indent;
			delete mapped.bottom;
			if (Object.keys(data).length) mapped.data = data;
			return mapped;
		}
		default: return mapped;
	}
}

function publicationFrontmatter(raw: string): MdiPublicationFrontmatter {
	let value: unknown;
	try { value = parseYaml(raw); } catch { value = undefined; }
	const source = isRecord(value) ? value : {};
	const writingMode = source["writing-mode"] === "vertical" ? "vertical" : "horizontal";
	return {
		mdi: stringValue(source.mdi) ?? "2.0",
		title: stringValue(source.title),
		author: stringValue(source.author),
		lang: stringValue(source.lang) ?? "ja",
		date: stringValue(source.date),
		writingMode,
		pageProgression: source["page-progression"] === "ltr" || source["page-progression"] === "rtl"
			? source["page-progression"]
			: writingMode === "vertical" ? "rtl" : "ltr",
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function renderWithDiagnostics<T>(source: string, render: () => T): MdiRenderResult<T> {
	const parsed = parse(source);
	return {
		output: render(),
		document: parsed.document,
		diagnostics: parsed.diagnostics,
		headings: headingsFromDocument(parsed.document),
	};
}

async function renderWithDiagnosticsAsync<T>(
	source: string,
	render: () => Promise<T>,
): Promise<MdiRenderResult<T>> {
	const parsed = parse(source);
	return {
		output: await render(),
		document: parsed.document,
		diagnostics: parsed.diagnostics,
		headings: headingsFromDocument(parsed.document),
	};
}

function assertSource(source: unknown): asserts source is string {
	if (typeof source !== "string") throw new TypeError("source must be a string");
}

function assertHtmlOptions(options: unknown): asserts options is MdiHtmlRenderOptions | undefined {
	if (options === undefined) return;
	assertPlainObject(options, "options");
	if (options.bodyOnly !== undefined && typeof options.bodyOnly !== "boolean") {
		throw new TypeError("options.bodyOnly must be a boolean");
	}
}

function htmlBody(html: string): string {
	const match = /<body(?:\s[^>]*)?>([\s\S]*)<\/body>/i.exec(html);
	if (!match) throw new Error("Rust HTML renderer returned a document without a body");
	return match[1];
}

function headingsFromDocument(document: MdiDocument): MdiHeading[] {
	const headings: MdiHeading[] = [];
	visitNodes(document.children, (node) => {
		if (node.type !== "heading" || !isHeadingDepth(node.depth)) return;
		headings.push({
			depth: node.depth,
			text: plainNodeText(node),
			span: node.span,
			node,
		});
	});
	return headings;
}

function visitNodes(nodes: MdiNode[], visit: (node: MdiNode) => void): void {
	for (const node of nodes) {
		visit(node);
		if (node.children) visitNodes(node.children, visit);
	}
}

function isHeadingDepth(value: unknown): value is MdiHeading["depth"] {
	return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6;
}

function plainNodeText(node: MdiNode): string {
	if (node.type === "ruby" && typeof node.base === "string") return node.base;
	const value = node.value;
	const ownText = typeof value === "string" ? value : "";
	return ownText + (node.children?.map(plainNodeText).join("") ?? "");
}

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`${label} must be an object`);
	}
}

function assertEpubOptions(options: unknown): asserts options is MdiEpubExportOptions {
	assertPlainObject(options, "options");
	if (options.cover !== undefined) {
		assertPlainObject(options.cover, "options.cover");
		if (!(options.cover.data instanceof Uint8Array)) {
			throw new TypeError("options.cover.data must be a Uint8Array");
		}
		if (options.cover.mediaType !== "image/jpeg" && options.cover.mediaType !== "image/png") {
			throw new TypeError("options.cover.mediaType must be image/jpeg or image/png");
		}
	}
	if (options.coverImage !== undefined && !(options.coverImage instanceof Uint8Array)) {
		throw new TypeError("options.coverImage must be a Uint8Array");
	}
	if (options.coverMediaType !== undefined && options.coverMediaType !== "image/jpeg" && options.coverMediaType !== "image/png") {
		throw new TypeError("options.coverMediaType must be image/jpeg or image/png");
	}
}

function normalizeEpubOptions(options: MdiEpubExportOptions): EpubExportOptions {
	const {
		title, author, publisher, identifier, language, date,
		verticalWriting, fontFamily, fontSize, lineSpacing, textIndent, fullwidthSpaceIndent, gridMode, chapterSplitLevel,
		coverImage, coverMediaType, cover, profile,
	} = options;
	const metadata = { ...profile?.metadata, ...defined({ title, author, publisher, identifier, language, date }) };
	const writingMode: WritingMode | undefined = verticalWriting === undefined
		? undefined
		: verticalWriting ? "vertical" : "horizontal";
	const typesetting = {
		...profile?.typesetting,
		...defined({
			writingMode,
			fontFamily,
			fontSize,
			lineSpacing,
			textIndentEm: textIndent,
			fullwidthSpaceIndent,
		}),
	};
	const epub = { ...profile?.epub, ...defined({ chapterSplitLevel }) };
	return {
		profile: {
			...profile,
			metadata,
			typesetting,
			epub,
			pagination: { ...profile?.pagination, ...defined({ gridMode }) },
		},
		cover: cover ?? (coverImage ? { data: coverImage, mediaType: coverMediaType ?? "image/png" } : undefined),
	};
}

function normalizeDocxProfile(profile: MdiDocxExportProfile): ExportProfile {
	const {
		title, author, publisher, identifier, language, date,
		verticalWriting, fontFamily, fontSize, lineSpacing, textIndent,
		pageSize, landscape, gridMode, charactersPerLine, linesPerPage, margins, fullwidthSpaceIndent,
		showPageNumbers, pageNumberPosition, pageNumberFormat,
		...nested
	} = profile;
	const writingMode: WritingMode | undefined = verticalWriting === undefined
		? undefined : verticalWriting ? "vertical" : "horizontal";
	return {
		...nested,
		metadata: { ...nested.metadata, ...defined({ title, author, publisher, identifier, language, date }) },
		typesetting: {
			...nested.typesetting,
			...defined({ writingMode, fontFamily, fontSize, lineSpacing, textIndentEm: textIndent, fullwidthSpaceIndent }),
		},
		pagination: {
			...nested.pagination,
			...defined({ pageSize, landscape, gridMode, charactersPerLine, linesPerPage, margins }),
			pageNumbers: {
				...nested.pagination?.pageNumbers,
				...defined({ enabled: showPageNumbers, position: pageNumberPosition, format: pageNumberFormat }),
			},
		},
	};
}

function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
	return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

/** Parse and normalize complete `.mdi` source with Rust's serializer. */
export function serializeMdi(source: string): string {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	return serializeMdiFromRust(source);
}

/** Render complete `.mdi` source to deterministic plain text in Rust. */
export function renderText(source: string): string {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	return renderTextFromRust(source);
}

/** Render plain text without discarding Rust diagnostics and source spans. */
export function renderTextWithDiagnostics(source: string): MdiRenderResult<string> {
	return renderWithDiagnostics(source, () => renderText(source));
}

export type MdiTextFormat = "txt" | "txt-ruby" | "narou" | "kakuyomu" | "aozora" | "note";

/** Render a named publication-text convention through Rust. */
export function renderTextFormat(
	source: string,
	format: MdiTextFormat,
	indentPrefix = "",
): string {
	if (typeof source !== "string" || typeof indentPrefix !== "string") {
		throw new TypeError("source and indentPrefix must be strings");
	}
	return renderTextFormatFromRust(source, format, indentPrefix);
}

/** Render a named text format without discarding Rust diagnostics and spans. */
export function renderTextFormatWithDiagnostics(
	source: string,
	format: MdiTextFormat,
	indentPrefix = "",
): MdiRenderResult<string> {
	return renderWithDiagnostics(source, () => renderTextFormat(source, format, indentPrefix));
}

/** @deprecated Use {@link parse}; it now parses the complete document. */
export const parseMdiSyntax = parse;
