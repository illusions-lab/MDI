import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMdiTextBlocks, parse, parseMdiSyntax, prepareRender, renderHtmlWithDiagnostics, renderTextWithDiagnostics, serializeMdi, toPublicationMdast } from "./index.js";
import { parseForMdast } from "./internal/mdast.js";

const fixtures = JSON.parse(readFileSync(new URL("../../../../mdi-core/tests/fixtures/comments/cases.json", import.meta.url), "utf8")) as Array<{name:string; source:string; values:string[]}>;
const values = (node: any): string[] => [
  ...(node.type === "comment" || node.type === "mdiComment" ? [node.value] : []),
  ...(node.children ?? []).flatMap(values),
];

describe("editorial comment contract", () => {
  for (const fixture of fixtures) it(fixture.name, () => {
    for (const api of [parse, parseMdiSyntax, prepareRender, parseForMdast, getMdiTextBlocks]) {
      expect(values(api(fixture.source).document)).toEqual([]);
      const included = api(fixture.source, { includeComments: true });
      expect(included.irVersion).toBe("1.1");
      expect(values(included.document)).toEqual(fixture.values);
    }
    expect(values(parse(serializeMdi(fixture.source), {includeComments:true}).document)).toEqual(fixture.values);
  });

  it("keeps publication output and body projection independent from requested IR", () => {
    const source = "前<!--UNIQUE_COMMENT_SENTINEL-->後";
    for (const api of [renderHtmlWithDiagnostics, renderTextWithDiagnostics]) {
      const result = api(source, { includeComments:true });
      expect(values(result.document)).toEqual(["UNIQUE_COMMENT_SENTINEL"]);
      expect(result.output).not.toContain("UNIQUE_COMMENT_SENTINEL");
    }
    const full = parse(source, {includeComments:true}).document;
    expect(values(toPublicationMdast(full))).toEqual([]);
    expect(values(toPublicationMdast(full, {includeComments:true}))).toEqual(["UNIQUE_COMMENT_SENTINEL"]);
    expect(getMdiTextBlocks(source, {includeComments:true}).blocks[0].text).toBe("前後");
  });
});
