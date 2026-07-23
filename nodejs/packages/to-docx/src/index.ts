import { renderDocxWithProfile } from "@illusions-lab/mdi-core";
import type { ExportProfile } from "@illusions-lab/mdi-export-profile";
import { mdastToMdiSource } from "mdast-util-mdi";
import type { Root } from "mdast";

export const MDI_SPEC_VERSION = "2.0";

/**
 * Preserve the mdast-facing package API while delegating OOXML generation to
 * the single Rust implementation used by every language binding.
 */
export async function mdiToDocx(
  tree: Root,
  profile?: ExportProfile,
): Promise<Buffer> {
  if (!tree || tree.type !== "root" || !Array.isArray(tree.children))
    throw new TypeError("tree must be an mdast root");
  if (profile !== undefined && (
    !profile ||
    typeof profile !== "object" ||
    Array.isArray(profile)
  ))
    throw new TypeError("profile must be an object");
  return Buffer.from(
    renderDocxWithProfile(mdastToMdiSource(tree), JSON.stringify(profile ?? {})),
  );
}
