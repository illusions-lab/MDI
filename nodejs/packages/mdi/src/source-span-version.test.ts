import { describe, expect, it, vi } from "vitest";

vi.mock("@illusions-lab/mdi-core", async (importOriginal) => {
	const original = await importOriginal<typeof import("@illusions-lab/mdi-core")>();
	return {
		...original,
		resolveMdiSourceSpanJson: () => JSON.stringify({
			projectionVersion: "9.9",
			sourceSpan: { startByte: 0, endByte: 0 },
			coverage: "none",
			matches: [],
		}),
	};
});

import { resolveMdiSourceSpan } from "./index.js";

describe("resolveMdiSourceSpan projection-version guard", () => {
	it("rejects an unsupported Rust projection version", () => {
		expect(() => resolveMdiSourceSpan("", { startByte: 0, endByte: 0 })).toThrow(
			"Unsupported MDI text projection version: 9.9",
		);
	});
});
