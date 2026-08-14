import { parseMdiMdastJson } from "@illusions-lab/mdi-core";
import {
	MDI_IR_VERSION,
	MDI_SPEC_VERSION,
	type MdiDiagnostic,
	type MdiDocument,
	type MdiFrontmatter,
	type MdiNode,
	type MdiParserCapabilities,
	type MdiSourceSpan,
	type MdiTextRange,
} from "../index.js";

/** Version of Rust-owned transient mdast provenance records. */
export const MDI_MDAST_PROVENANCE_VERSION = "1.0" as const;

/** A projection target assigned by Rust to a source-backed IR construct. */
export type MdiMdastProvenanceTarget =
	| { blockIndex: number; channel: "blockText"; range: MdiTextRange }
	| { blockIndex: number; channel: "annotation"; annotationIndex: number; range: MdiTextRange };

/**
 * Transient identity and projection metadata emitted by Rust for mdast
 * adapters. `construct.path` is valid only for this parse result; it is not a
 * persisted document ID and must not be inferred from text or order.
 */
export interface MdiMdastProvenance {
	version: typeof MDI_MDAST_PROVENANCE_VERSION;
	construct: { path: string; type: string };
	span: MdiSourceSpan | null;
	role: "container" | "textBearing";
	status: "sourceBacked" | "synthetic" | "unmapped";
	targets: MdiMdastProvenanceTarget[];
}

export type MdiMdastNode = Omit<MdiNode, "children"> & {
	mdiProvenance?: MdiMdastProvenance;
	children?: MdiMdastNode[];
};

export type MdiMdastFrontmatter = MdiFrontmatter & {
	mdiProvenance: MdiMdastProvenance;
};

export type MdiMdastDocument = Omit<MdiDocument, "frontmatter" | "children"> & {
	frontmatter?: MdiMdastFrontmatter;
	children: MdiMdastNode[];
};

export interface MdiMdastParseResult {
	irVersion: typeof MDI_IR_VERSION;
	syntaxVersion: typeof MDI_SPEC_VERSION;
	capabilities: MdiParserCapabilities;
	document: MdiMdastDocument;
	diagnostics: MdiDiagnostic[];
}

/** Rust-backed transport exclusively for mdast adapters. */
export function parseForMdast(source: string): MdiMdastParseResult {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	const result = JSON.parse(parseMdiMdastJson(source)) as MdiMdastParseResult;
	if (result.irVersion !== MDI_IR_VERSION) {
		throw new Error(`Unsupported MDI IR version: ${String(result.irVersion)}`);
	}
	return result;
}
