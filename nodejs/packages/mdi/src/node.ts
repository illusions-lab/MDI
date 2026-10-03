import {
	parse,
	renderHtml,
	type MdiDocument,
	type MdiParseOptions,
	type MdiHeading,
	type MdiNode,
	type MdiRenderResult,
} from "./index.js";
import {
	requireLayoutSystem,
	type ExportProfile,
} from "@illusions-lab/mdi-export-profile";

/** A Chromium-capable adapter which turns complete HTML into a PDF. */
export interface MdiPdfChromiumAdapter {
	renderHtmlToPdf(
		html: string,
		profile?: ExportProfile,
		sourceWritingMode?: unknown,
	): Promise<Uint8Array>;
}

/**
 * The explicit hand-off from Rust MDI rendering to a browser print engine.
 * Page geometry, fonts, and pagination are browser-layout concerns, so the
 * profile is kept separate from the MDI document IR.
 */
export interface MdiPdfExportRequest {
	html: string;
	profile?: ExportProfile;
	sourceWritingMode?: "vertical" | "horizontal";
}

/**
 * Render MDI to Rust-owned HTML and prepare a Chromium PDF request.
 *
 * This browser-safe helper does not load Playwright or launch Chromium.
 * Electron callers may print the returned HTML with their own BrowserWindow.
 */
export function preparePdfExport(
	source: string,
	profile?: ExportProfile,
): MdiPdfExportRequest {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	if (profile !== undefined) requireLayoutSystem(profile);
	const writingMode = parse(source).document.frontmatter?.entries.find(
		(entry) => entry.key === "writing-mode" || entry.key === "writingMode",
	)?.value;
	return {
		html: renderHtml(source),
		profile,
		sourceWritingMode:
			writingMode === "vertical" || writingMode === "horizontal"
				? writingMode
				: undefined,
	};
}

/**
 * Prepare a PDF export without losing the Rust diagnostics, source spans, or
 * source-order headings that a host UI needs to present before printing.
 */
export function preparePdfExportWithDiagnostics(
	source: string,
	profile?: ExportProfile,
	options: MdiParseOptions = {},
): MdiRenderResult<MdiPdfExportRequest> {
	if (typeof source !== "string") throw new TypeError("source must be a string");
	if (profile !== undefined) requireLayoutSystem(profile);
	const parsed = parse(source, options);
	const writingMode = parsed.document.frontmatter?.entries.find(
		(entry) => entry.key === "writing-mode" || entry.key === "writingMode",
	)?.value;
	return {
		output: {
			html: renderHtml(source),
			profile,
			sourceWritingMode:
				writingMode === "vertical" || writingMode === "horizontal"
					? writingMode
					: undefined,
		},
		document: parsed.document,
		diagnostics: parsed.diagnostics,
		headings: headingsFromDocument(parsed.document),
	};
}

/**
 * Print MDI through Chromium. The default Playwright adapter is loaded only
 * by this Node-only entry point; Electron can supply its own adapter.
 */
export async function renderPdfWithChromium(
	source: string,
	profile?: ExportProfile,
	adapter?: MdiPdfChromiumAdapter,
): Promise<Uint8Array> {
	const request = preparePdfExport(source, profile);
	const chromiumAdapter = adapter ?? (await loadPlaywrightPdfAdapter());
	return chromiumAdapter.renderHtmlToPdf(
		request.html,
		request.profile,
		request.sourceWritingMode,
	);
}

/** Print through Chromium while retaining the Rust parse result for host UIs. */
export async function renderPdfWithChromiumWithDiagnostics(
	source: string,
	profile?: ExportProfile,
	adapter?: MdiPdfChromiumAdapter,
	options: MdiParseOptions = {},
): Promise<MdiRenderResult<Uint8Array>> {
	const prepared = preparePdfExportWithDiagnostics(source, profile, options);
	const chromiumAdapter = adapter ?? (await loadPlaywrightPdfAdapter());
	return {
		...prepared,
		output: await chromiumAdapter.renderHtmlToPdf(
			prepared.output.html,
			prepared.output.profile,
			prepared.output.sourceWritingMode,
		),
	};
}

function headingsFromDocument(document: MdiDocument): MdiHeading[] {
	const headings: MdiHeading[] = [];
	const visit = (nodes: MdiNode[]): void => {
		for (const node of nodes) {
			if (node.type === "heading" && isHeadingDepth(node.depth)) {
				headings.push({ depth: node.depth, text: plainText(node), span: node.span, node });
			}
			if (node.children) visit(node.children);
		}
	};
	visit(document.children);
	return headings;
}

function isHeadingDepth(value: unknown): value is 1 | 2 | 3 | 4 | 5 | 6 {
	return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6;
}

function plainText(node: MdiNode): string {
	if (node.type === "comment") return "";
	if (node.type === "ruby" && typeof node.base === "string") return node.base;
	return (typeof node.value === "string" ? node.value : "") + (node.children?.map(plainText).join("") ?? "");
}

async function loadPlaywrightPdfAdapter(): Promise<MdiPdfChromiumAdapter> {
	// Keep this package optional: browser and Electron consumers should not
	// download Playwright merely by installing the core MDI binding.
	const packageName = "@illusions-lab/mdi-to-pdf";
	try {
		return (await import(packageName)) as MdiPdfChromiumAdapter;
	} catch (error) {
		throw new Error(
			"PDF export needs @illusions-lab/mdi-to-pdf, or pass an Electron-compatible adapter to renderPdfWithChromium().",
			{ cause: error },
		);
	}
}

export type { ExportProfile } from "@illusions-lab/mdi-export-profile";
