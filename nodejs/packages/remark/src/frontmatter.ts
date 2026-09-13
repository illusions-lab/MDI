import type { Root } from "mdast";
import { parse } from "yaml";

export interface MdiFrontmatter {
	mdi: string;
	title?: string;
	author?: string;
	lang: string;
	date?: string;
	writingMode: "horizontal" | "vertical";
	pageProgression: "ltr" | "rtl";
}

declare module "mdast" {
	interface RootData {
		frontmatter?: MdiFrontmatter;
	}
}

export function resolveFrontmatter(tree: Root): void {
	const yaml = tree.children[0];
	const value = yaml?.type === "yaml" ? parseYaml(yaml.value) : undefined;
	const source = isRecord(value) ? value : {};
	const writingMode =
		source["writing-mode"] === "vertical" ? "vertical" : "horizontal";

	tree.data ??= {};
	tree.data.frontmatter = {
		mdi: stringValue(source.mdi) ?? "2.1",
		title: stringValue(source.title),
		author: stringValue(source.author),
		lang: stringValue(source.lang) ?? "ja",
		date: stringValue(source.date),
		writingMode,
		pageProgression:
			source["page-progression"] === "ltr" ||
			source["page-progression"] === "rtl"
				? source["page-progression"]
				: writingMode === "vertical"
					? "rtl"
					: "ltr",
	};
}

/** Malformed front matter degrades to all-defaults rather than failing the whole parse. */
function parseYaml(value: string): unknown {
	try {
		return parse(value);
	} catch {
		return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}
