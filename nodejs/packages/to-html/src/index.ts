import { renderHtml } from "@illusions-lab/mdi-core";
import { mdastToMdiSource } from "mdast-util-mdi";
import type { Root } from "mdast";

export const MDI_SPEC_VERSION = "2.0";

/**
 * Preserve the mdast-facing API while Rust remains the only HTML renderer.
 * This adapter serializes the host tree back to portable MDI source.
 */
export function mdiToHtml(tree: Root): string {
  if (!tree || tree.type !== "root" || !Array.isArray(tree.children))
    throw new TypeError("tree must be an mdast root");
  return renderHtml(mdastToMdiSource(tree));
}
