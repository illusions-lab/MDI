import { renderEpubWithProfile } from "@illusions-lab/mdi-core";
import type { ExportProfile } from "@illusions-lab/mdi-export-profile";
import { mdastToMdiSource } from "mdast-util-mdi";
import type { Root } from "mdast";

export const MDI_SPEC_VERSION = "2.0";

export interface EpubCover {
  data: Uint8Array;
  mediaType: "image/jpeg" | "image/png";
}

export interface EpubExportOptions {
  profile?: ExportProfile;
  cover?: EpubCover;
}

/**
 * Preserve the mdast-facing package API while delegating the actual EPUB
 * package to the single Rust implementation shared by every binding.
 */
export async function mdiToEpub(
  tree: Root,
  options: EpubExportOptions = {},
): Promise<Buffer> {
  if (!tree || tree.type !== "root" || !Array.isArray(tree.children))
    throw new TypeError("tree must be an mdast root");
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw new TypeError("options must be an object");
  if (options.profile !== undefined && (
    !options.profile ||
    typeof options.profile !== "object" ||
    Array.isArray(options.profile)
  ))
    throw new TypeError("profile must be an object");
  if (options.cover !== undefined) {
    if (!options.cover || typeof options.cover !== "object" || Array.isArray(options.cover))
      throw new TypeError("cover must be an object");
    if (!(options.cover.data instanceof Uint8Array))
      throw new TypeError("cover.data must be a Uint8Array");
    if (options.cover.mediaType !== "image/jpeg" && options.cover.mediaType !== "image/png")
      throw new TypeError("cover.mediaType must be image/jpeg or image/png");
  }

  const cover = options.cover;
  return Buffer.from(
    renderEpubWithProfile(
      mdastToMdiSource(tree),
      JSON.stringify(options.profile ?? {}),
      cover?.data ?? new Uint8Array(),
      cover?.mediaType,
    ),
  );
}
