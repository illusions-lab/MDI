import { describe, expect, it } from "vitest";
import { unescapeMdi } from "@illusions-lab/mdi-core";

describe("unescapeMdi", () => {
	it.each([
		[String.raw`\{`, "{"],
		[String.raw`\}`, "}"],
		[String.raw`\|`, "|"],
		[String.raw`\^`, "^"],
		[String.raw`\[`, "["],
		[String.raw`\]`, "]"],
		[String.raw`\:`, ":"],
		[String.raw`\《`, "《"],
		[String.raw`\》`, "》"],
		[String.raw`\\`, "\\"],
	])("unescapes %s to %s", (input, expected) => {
		expect(unescapeMdi(input)).toBe(expected);
	});

	it.each([String.raw`\n`, String.raw`\a`, String.raw`\0`, String.raw`\-`])("leaves a backslash before non-escapable %s alone", (value) => {
		expect(unescapeMdi(value)).toBe(value);
	});

	it("unescapes multiple occurrences in one string", () => {
		expect(unescapeMdi(String.raw`\{東\|京\}`)).toBe("{東|京}");
	});
});
