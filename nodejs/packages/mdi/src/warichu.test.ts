import { describe, expect, it } from "vitest";
import { layoutMdiWarichu, parse, renderHtml, renderText, serializeMdi } from "./index.js";

describe("Rust warichu layout binding", () => {
  it("uses parsed children without changing canonical MDI", () => {
    const source = "[[warichu:一二三四五]]";
    const document = parse(source).document;
    const before = JSON.stringify(document);
    const children = document.children[0]!.children![0]!.children!;
    const fragments = layoutMdiWarichu(children);
    expect(fragments[0]?.widths).toEqual([6, 4]);
    expect(fragments[0]?.lines.map(line => line.map(n => n.value).join(""))).toEqual(["一二三", "四五"]);
    expect(JSON.stringify(document)).toBe(before);
    expect(serializeMdi(source)).not.toContain("[[br]]");
    expect(renderText(source).trim()).toBe("一二三四五");
    expect(renderHtml(source)).toContain('class="mdi-warichu-line"');
  });
  it("diagnoses oversized indivisible content and rejects invalid capacity", () => {
    const atomic = [{ type: "noBreak", children: [{ type: "text", value: "一二三四" }] }];
    expect(layoutMdiWarichu(atomic, 1)[0]?.overflow).toBe(true);
    for (const capacity of [0, -1, 1.5, Infinity, NaN, 0x100000000]) {
      expect(() => layoutMdiWarichu(atomic, capacity)).toThrow(RangeError);
    }
    expect(layoutMdiWarichu([])).toEqual([]);
  });
});
