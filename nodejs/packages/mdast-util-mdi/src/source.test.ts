import { describe, expect, it } from "vitest";
import type { Root } from "mdast";
import { mdastToMdiSource } from "./source.js";

describe("mdastToMdiSource", () => {
  it("preserves a YAML node and serializes GFM plus MDI through one path", () => {
    const tree = {
      type: "root",
      children: [
        { type: "yaml", value: "title: 契約" },
        {
          type: "paragraph",
          children: [
            { type: "mdiRuby", base: "東京", ruby: "とうきょう" },
          ],
        },
      ],
    } as unknown as Root;
    expect(mdastToMdiSource(tree)).toBe(
      "---\ntitle: 契約\n---\n\n{東京|とうきょう}\n",
    );
  });

  it("reconstitutes documented scalar data when a direct tree has no YAML node", () => {
    const tree = {
      type: "root",
      data: {
        frontmatter: {
          title: 'A < B & "quoted"',
          lang: "ja",
          writingMode: "vertical",
          ignored: 42,
        },
      },
      children: [
        { type: "paragraph", children: [{ type: "text", value: "本文" }] },
      ],
    } as Root;
    expect(mdastToMdiSource(tree)).toBe(
      '---\ntitle: "A < B & \\"quoted\\""\nlang: "ja"\nwriting-mode: "vertical"\n---\n\n本文\n',
    );
  });

  it("does not invent front matter for an ordinary root", () => {
    const tree = {
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "plain" }] },
      ],
    } as Root;
    expect(mdastToMdiSource(tree)).toBe("plain\n");
  });
});
