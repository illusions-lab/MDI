import { describe, expect, it } from "vitest";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { mdi } from "micromark-extension-mdi";
import type { Root } from "mdast";
import { mdiFromMarkdown } from "./from-markdown.js";
import { mdiToMarkdown } from "./to-markdown.js";

function parse(value: string): Root {
	return fromMarkdown(value, {
		extensions: [mdi()],
		mdastExtensions: [mdiFromMarkdown()],
	});
}

function serialize(tree: Root): string {
	return toMarkdown(tree, { extensions: [mdiToMarkdown()] });
}

function withoutPosition(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(withoutPosition);
	if (value && typeof value === "object") {
		const { position: _position, ...rest } = value as Record<string, unknown>;
		for (const key of Object.keys(rest)) rest[key] = withoutPosition(rest[key]);
		return rest;
	}
	return value;
}

function expectRoundTrip(value: string): void {
	const tree = parse(value);
	expect(withoutPosition(parse(serialize(tree)))).toEqual(withoutPosition(tree));
}

describe("mdiToMarkdown", () => {
	it.each([
		"{東京|とうきょう}",
		"{東京|とう.きょう}",
		"第^12^話",
		"[[em:それ]]",
		"[[em:●:それ]]",
		"[[no-break:keep together]]",
		"[[warichu:small note]]",
		"[[kern:-0.1em:tight]]",
		"a[[br]]b",
		"\\",
		"[[pagebreak]]",
		"[[pagebreak:right]]",
		"[[pagebreak:left]]",
		"[[indent:2]]\nparagraph",
		"[[bottom]]\nparagraph",
		"[[bottom:2]]\nparagraph",
		"[[em:{東京|とうきょう}]]",
		String.raw`{東\|京|とうきょう}`,
		String.raw`{東\{京|とうきょう}`,
		String.raw`[[em:\::text]]`,
		String.raw`《《a\《b》》`,
	])("round-trips %s", (value) => {
		expectRoundTrip(value);
	});

	it("normalizes the boten alias to the bracket form", () => {
		expect(serialize(parse("《《それ》》"))).toBe("[[em:それ]]\n");
	});

	it("uses the default-mark bracket form", () => {
		expect(serialize(parse("[[em:それ]]"))).toBe("[[em:それ]]\n");
	});
});
