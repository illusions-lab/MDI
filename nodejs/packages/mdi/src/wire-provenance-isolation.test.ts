import { describe, expect, it } from "vitest";
import { getMdiTextBlocks, parse } from "./index.js";

const source = `---
title: provenance isolation
---

> - {東京|とうきょう} ^12^
>   continuation

| image | empty |
| - | - |
| ![alt](cover.png) | ![](empty.png) |`;

describe("general wire provenance isolation", () => {
	it("keeps mdast provenance out of parse and text-projection JSON", () => {
		for (const result of [parse(source), getMdiTextBlocks(source)]) {
			expect(JSON.stringify(result)).not.toContain('"mdiProvenance"');
		}
	});
});
