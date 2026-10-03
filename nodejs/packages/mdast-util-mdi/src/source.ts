import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import type { Root } from "mdast";
import { mdiToMarkdown } from "./to-markdown.js";

/**
 * Serialize a host mdast root to portable MDI source before passing it to the
 * Rust core. This is the sole mdast compatibility serialization path.
 */
export function mdastToMdiSource(tree: Root): string {
  const yaml = tree.children.find(
    (node): node is Root["children"][number] & { type: "yaml"; value: string } =>
      node.type === "yaml" && typeof (node as { value?: unknown }).value === "string",
  );
  const body = toMarkdown(
    {
      ...tree,
      children: tree.children.filter((node) => node.type !== "yaml"),
    },
    { extensions: [gfmToMarkdown(), mdiToMarkdown()] },
  );
  if (yaml) return `---\n${yaml.value}\n---\n\n${body}`;

  // Some mdast consumers retain resolved scalar front matter in data while
  // discarding the YAML node. Reconstituting those values is serialization,
  // not syntax interpretation; Rust still parses and renders the result.
  const data = tree.data as { frontmatter?: Record<string, unknown> } | undefined;
  const frontmatter = data?.frontmatter;
  if (!frontmatter || typeof frontmatter !== "object") return body;
  const lines: string[] = [];
  for (const [key, sourceKey] of [
    ["title", "title"],
    ["author", "author"],
    ["lang", "lang"],
    ["date", "date"],
    ["writingMode", "writing-mode"],
    ["pageProgression", "page-progression"],
  ] as const) {
    const value = frontmatter[key];
    if (typeof value === "string") lines.push(`${sourceKey}: ${JSON.stringify(value)}`);
  }
  return lines.length > 0 ? `---\n${lines.join("\n")}\n---\n\n${body}` : body;
}
