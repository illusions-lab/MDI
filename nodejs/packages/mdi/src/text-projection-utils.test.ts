import { describe, expect, it } from "vitest";
import {
	formatMdiTextPosition,
	formatMdiTextRange,
	parseMdiTextPosition,
	sourceSpansForTextRange,
	type MdiTextBlock,
	type MdiTextSourceRun,
} from "./index.js";

function blockWithRuns(
	runs: MdiTextSourceRun[],
	overrides: Partial<MdiTextBlock> = {},
): MdiTextBlock {
	return {
		index: 1,
		kind: "paragraph",
		text: "abcdef",
		range: { start: "1:1", end: "1:7" },
		span: { startByte: 0, endByte: 100 },
		sourceMap: { runs, synthetic: [], unmapped: [] },
		annotations: [],
		node: { type: "paragraph" },
		...overrides,
	};
}

describe("MDI text position utilities", () => {
	it("parses canonical one-based positions through the safe-integer limit", () => {
		expect(parseMdiTextPosition("1:1")).toEqual({ block: 1, character: 1 });
		expect(parseMdiTextPosition("3:18")).toEqual({ block: 3, character: 18 });
		expect(parseMdiTextPosition(`${Number.MAX_SAFE_INTEGER}:${Number.MAX_SAFE_INTEGER}`)).toEqual({
			block: Number.MAX_SAFE_INTEGER,
			character: Number.MAX_SAFE_INTEGER,
		});
	});

	it.each([
		"0:1",
		"1:0",
		"-1:1",
		"1:-1",
		"1.5:2",
		"1:2.5",
		"NaN:1",
		"1:NaN",
		"Infinity:1",
		"1:Infinity",
		"01:1",
		"1:01",
		"+1:1",
		"1e2:1",
		"1",
		"1:2:3",
		" 1:2",
		"1:2 ",
		"1 : 2",
		`${Number.MAX_SAFE_INTEGER + 1}:1`,
		`1:${Number.MAX_SAFE_INTEGER + 1}`,
	])("rejects non-canonical position %j", (position) => {
		expect(() => parseMdiTextPosition(position)).toThrow("Invalid MDI text position");
	});

	it("rejects non-string parse input", () => {
		expect(() => parseMdiTextPosition(Number.NaN as never)).toThrow(TypeError);
		expect(() => parseMdiTextPosition(null as never)).toThrow(TypeError);
	});

	it("formats only positive safe-integer values", () => {
		expect(formatMdiTextPosition({ block: 3, character: 18 })).toBe("3:18");
		expect(formatMdiTextPosition({
			block: Number.MAX_SAFE_INTEGER,
			character: Number.MAX_SAFE_INTEGER,
		})).toBe(`${Number.MAX_SAFE_INTEGER}:${Number.MAX_SAFE_INTEGER}`);

		for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
			expect(() => formatMdiTextPosition({ block: invalid, character: 1 })).toThrow(RangeError);
			expect(() => formatMdiTextPosition({ block: 1, character: invalid })).toThrow(RangeError);
		}
		expect(() => formatMdiTextPosition(null as never)).toThrow(TypeError);
		expect(() => formatMdiTextPosition("1:1" as never)).toThrow(TypeError);
	});

	it("formats ordered same-block ranges, including empty ranges", () => {
		expect(formatMdiTextRange({ start: "3:18", end: "3:24" })).toBe("3:18-3:24");
		expect(formatMdiTextRange({ start: "3:18", end: "3:18" })).toBe("3:18-3:18");
	});

	it("rejects cross-block, reversed, non-canonical, and non-object ranges", () => {
		expect(() => formatMdiTextRange({ start: "3:18", end: "4:18" })).toThrow(RangeError);
		expect(() => formatMdiTextRange({ start: "3:19", end: "3:18" })).toThrow(RangeError);
		expect(() => formatMdiTextRange({ start: "3:18", end: "3:018" as never })).toThrow(RangeError);
		expect(() => formatMdiTextRange(null as never)).toThrow(TypeError);
	});
});

describe("sourceSpansForTextRange", () => {
	it("merges adjacent grapheme spans within and across runs", () => {
		const block = blockWithRuns([
			{ range: { start: "1:1", end: "1:3" }, sourceBoundaries: [10, 11, 13] },
			{ range: { start: "1:3", end: "1:5" }, sourceBoundaries: [13, 17, 20] },
		]);

		expect(sourceSpansForTextRange(block, { start: "1:1", end: "1:5" })).toEqual([
			{ startByte: 10, endByte: 20 },
		]);
	});

	it("keeps source-discontinuous runs separate", () => {
		const block = blockWithRuns([
			{ range: { start: "1:1", end: "1:3" }, sourceBoundaries: [10, 11, 13] },
			{ range: { start: "1:3", end: "1:5" }, sourceBoundaries: [30, 34, 40] },
		]);

		expect(sourceSpansForTextRange(block, { start: "1:2", end: "1:4" })).toEqual([
			{ startByte: 11, endByte: 13 },
			{ startByte: 30, endByte: 34 },
		]);
	});

	it("omits synthetic and unmapped text without manufacturing source spans", () => {
		const block = blockWithRuns(
			[
				{ range: { start: "1:1", end: "1:3" }, sourceBoundaries: [0, 1, 2] },
				{ range: { start: "1:4", end: "1:6" }, sourceBoundaries: [10, 11, 12] },
			],
			{
				sourceMap: {
					runs: [
						{ range: { start: "1:1", end: "1:3" }, sourceBoundaries: [0, 1, 2] },
						{ range: { start: "1:4", end: "1:6" }, sourceBoundaries: [10, 11, 12] },
					],
					synthetic: [{ start: "1:3", end: "1:4" }],
					unmapped: [{ start: "1:6", end: "1:7" }],
				},
			},
		);

		expect(sourceSpansForTextRange(block, { start: "1:3", end: "1:4" })).toEqual([]);
		expect(sourceSpansForTextRange(block, { start: "1:6", end: "1:7" })).toEqual([]);
		expect(sourceSpansForTextRange(block, { start: "1:2", end: "1:7" })).toEqual([
			{ startByte: 1, endByte: 2 },
			{ startByte: 10, endByte: 12 },
		]);
	});

	it("supports empty ranges at the beginning, middle, and exclusive block end", () => {
		const block = blockWithRuns([
			{ range: { start: "1:1", end: "1:7" }, sourceBoundaries: [0, 1, 2, 3, 4, 5, 6] },
		]);

		for (const position of ["1:1", "1:4", "1:7"] as const) {
			expect(sourceSpansForTextRange(block, { start: position, end: position })).toEqual([]);
		}
	});

	it("rejects ranges for another block, reversed ranges, and ranges outside the block", () => {
		const block = blockWithRuns([
			{ range: { start: "1:1", end: "1:7" }, sourceBoundaries: [0, 1, 2, 3, 4, 5, 6] },
		]);

		expect(() => sourceSpansForTextRange(block, { start: "2:1", end: "2:2" })).toThrow(
			"range must belong to the supplied text block",
		);
		expect(() => sourceSpansForTextRange(block, { start: "1:4", end: "2:5" })).toThrow(
			"range must belong to the supplied text block",
		);
		expect(() => sourceSpansForTextRange(block, { start: "1:5", end: "1:4" })).toThrow(
			"range falls outside the supplied text block",
		);
		expect(() => sourceSpansForTextRange(block, { start: "1:1", end: "1:8" })).toThrow(
			"range falls outside the supplied text block",
		);
		expect(() => sourceSpansForTextRange(null as never, { start: "1:1", end: "1:2" })).toThrow(TypeError);
	});

	it("rejects malformed source-boundary cardinality instead of returning a partial mapping", () => {
		const tooFew = blockWithRuns([
			{ range: { start: "1:1", end: "1:4" }, sourceBoundaries: [0, 1, 2] },
		]);
		const tooMany = blockWithRuns([
			{ range: { start: "1:1", end: "1:3" }, sourceBoundaries: [0, 1, 2, 3] },
		]);

		expect(() => sourceSpansForTextRange(tooFew, { start: "1:1", end: "1:2" })).toThrow(
			"Invalid MDI text source run",
		);
		expect(() => sourceSpansForTextRange(tooMany, { start: "1:1", end: "1:2" })).toThrow(
			"Invalid MDI text source run",
		);
	});

	it.each([
		{
			name: "a run from another block",
			runs: [{ range: { start: "2:1", end: "2:3" }, sourceBoundaries: [0, 1, 2] }],
		},
		{
			name: "overlapping runs",
			runs: [
				{ range: { start: "1:1", end: "1:4" }, sourceBoundaries: [0, 1, 2, 3] },
				{ range: { start: "1:3", end: "1:5" }, sourceBoundaries: [10, 11, 12] },
			],
		},
		{
			name: "a reversed run",
			runs: [{ range: { start: "1:4", end: "1:3" }, sourceBoundaries: [] }],
		},
		{
			name: "a run beyond the block text range",
			runs: [{ range: { start: "1:6", end: "1:8" }, sourceBoundaries: [0, 1, 2] }],
		},
	] satisfies Array<{ name: string; runs: MdiTextSourceRun[] }>)
		("rejects $name", ({ runs }) => {
			expect(() => sourceSpansForTextRange(blockWithRuns(runs), { start: "1:1", end: "1:2" }))
				.toThrow("Invalid MDI text source run");
		});

	it.each([
		{ name: "negative", boundaries: [-1, 0, 1] },
		{ name: "fractional", boundaries: [0, 0.5, 1] },
		{ name: "NaN", boundaries: [0, Number.NaN, 1] },
		{ name: "infinite", boundaries: [0, Number.POSITIVE_INFINITY, 1] },
		{ name: "unsafe-integer", boundaries: [0, Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1] },
		{ name: "descending", boundaries: [2, 1, 3] },
	])("rejects $name source boundaries", ({ boundaries }) => {
		const block = blockWithRuns([
			{ range: { start: "1:1", end: "1:3" }, sourceBoundaries: boundaries },
		]);
		expect(() => sourceSpansForTextRange(block, { start: "1:1", end: "1:2" }))
			.toThrow("Invalid MDI text source run");
	});

	it.each([
		{ name: "before", boundaries: [9, 10, 11] },
		{ name: "after", boundaries: [49, 50, 51] },
	])("rejects source boundaries $name the block source span", ({ boundaries }) => {
		const block = blockWithRuns(
			[{ range: { start: "1:1", end: "1:3" }, sourceBoundaries: boundaries }],
			{ span: { startByte: 10, endByte: 50 } },
		);
		expect(() => sourceSpansForTextRange(block, { start: "1:1", end: "1:2" }))
			.toThrow("Invalid MDI text source run");
	});
});
