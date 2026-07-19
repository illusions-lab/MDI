import JSZip from "jszip";
import { toHtml } from "hast-util-to-html";
import type { Root } from "mdast";
import type { RootContent as HastRootContent } from "hast";
import { MDI_STYLESHEET, mdiToHast } from "@illusions-lab/mdi-to-hast";
import {
  resolvePrintProfile,
  type ResolvedExportProfile,
  type ExportProfile,
} from "@illusions-lab/mdi-export-profile";

export const MDI_SPEC_VERSION = "2.0";

export interface EpubCover {
  data: Uint8Array;
  mediaType: "image/jpeg" | "image/png";
}
export interface EpubExportOptions {
  profile?: ExportProfile;
  cover?: EpubCover;
}

/** Builds a reflowable EPUB 3 with profile-driven metadata, cover, chapters and typography. */
export async function mdiToEpub(
  tree: Root,
  options: EpubExportOptions = {}
): Promise<Buffer> {
  const profile = resolvePrintProfile(
    options.profile,
    tree.data?.frontmatter?.writingMode
  );
  const zip = new JSZip();
  const { hast, frontmatter } = mdiToHast(tree);
  const title = profile.metadata.title ?? frontmatter?.title ?? "Untitled";
  const author = profile.metadata.author ?? frontmatter?.author;
  const lang = profile.metadata.language ?? frontmatter?.lang ?? "ja";
  const identifier = profile.metadata.identifier ?? crypto.randomUUID();
  const chapters = splitChapters(hast.children, profile.epub.chapterSplitLevel);
  const cover = options.cover;
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
  );
  zip.file("OEBPS/style.css", epubStyles(profile));
  zip.file(
    "OEBPS/nav.xhtml",
    xhtml(
      "Contents",
      lang,
      `<nav epub:type="toc" id="toc"><ol>${chapters
        .map(
          (chapter, i) =>
            `<li><a href="chapter-${i + 1}.xhtml">${xml(
              chapter.title || `Chapter ${i + 1}`
            )}</a></li>`
        )
        .join("")}</ol></nav>`
    )
  );
  chapters.forEach((chapter, index) =>
    zip.file(
      `OEBPS/chapter-${index + 1}.xhtml`,
      xhtml(
        chapter.title || title,
        lang,
        toHtml(
          { type: "root", children: chapter.children },
          { closeSelfClosing: true, tightSelfClosing: true }
        )
      )
    )
  );
  if (cover) {
    zip.file(
      `OEBPS/cover.${cover.mediaType === "image/png" ? "png" : "jpg"}`,
      cover.data
    );
    zip.file(
      "OEBPS/cover.xhtml",
      xhtml(
        title,
        lang,
        `<img src="cover.${
          cover.mediaType === "image/png" ? "png" : "jpg"
        }" alt="${xml(title)}"/>`
      )
    );
  }
  const metadata = `<dc:identifier id="book-id">${xml(
    identifier
  )}</dc:identifier><dc:title>${xml(title)}</dc:title><dc:language>${xml(
    lang
  )}</dc:language>${author ? `<dc:creator>${xml(author)}</dc:creator>` : ""}${
    profile.metadata.publisher
      ? `<dc:publisher>${xml(profile.metadata.publisher)}</dc:publisher>`
      : ""
  }${
    profile.metadata.date ?? frontmatter?.date
      ? `<dc:date>${xml(
          String(profile.metadata.date ?? frontmatter?.date)
        )}</dc:date>`
      : ""
  }`;
  const coverManifest = cover
    ? `<item id="cover-image" href="cover.${
        cover.mediaType === "image/png" ? "png" : "jpg"
      }" media-type="${
        cover.mediaType
      }" properties="cover-image"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`
    : "";
  const manifest = `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${coverManifest}${chapters
    .map(
      (_, i) =>
        `<item id="chapter-${i + 1}" href="chapter-${
          i + 1
        }.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join("")}`;
  const spine = `${cover ? '<itemref idref="cover"/>' : ""}${chapters
    .map((_, i) => `<itemref idref="chapter-${i + 1}"/>`)
    .join("")}`;
  zip.file(
    "OEBPS/package.opf",
    `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${metadata}</metadata><manifest>${manifest}</manifest><spine${
      profile.typesetting.writingMode === "vertical"
        ? ' page-progression-direction="rtl"'
        : ""
    }>${spine}</spine></package>`
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

interface Chapter {
  title: string;
  children: HastRootContent[];
}
function splitChapters(
  children: HastRootContent[],
  level: "h1" | "h2" | "h3" | "none"
): Chapter[] {
  if (level === "none")
    return [
      { title: "", children: children.filter((child) => !isPagebreak(child)) },
    ];
  const chapters: Chapter[] = [{ title: "", children: [] }];
  const splitTag = level;
  for (const child of children) {
    if (isPagebreak(child)) {
      if (chapters.at(-1)!.children.length)
        chapters.push({ title: "", children: [] });
      continue;
    }
    if (
      child.type === "element" &&
      child.tagName === splitTag &&
      chapters.at(-1)!.children.length
    )
      chapters.push({ title: textContent(child), children: [child] });
    else {
      if (child.type === "element" && child.tagName === splitTag)
        chapters.at(-1)!.title = textContent(child);
      chapters.at(-1)!.children.push(child);
    }
  }
  return chapters.filter((chapter) => chapter.children.length > 0);
}
function isPagebreak(node: HastRootContent): boolean {
  return (
    node.type === "element" &&
    node.tagName === "div" &&
    Array.isArray(node.properties?.className) &&
    node.properties.className.includes("mdi-pagebreak")
  );
}
function textContent(node: HastRootContent): string {
  return node.type === "text"
    ? node.value
    : node.type === "element"
    ? node.children.map(textContent).join("")
    : "";
}
function epubStyles(profile: ResolvedExportProfile): string {
  const mode =
    profile.typesetting.writingMode === "vertical"
      ? "writing-mode:vertical-rl;-webkit-writing-mode:vertical-rl;text-orientation:mixed;"
      : "";
  return `body{font-family:${css(
    profile.typesetting.fontFamily
  )};${mode}line-height:1.8;margin:1em}p{text-indent:${
    profile.typesetting.textIndentEm
  }em;margin:.3em 0}${MDI_STYLESHEET}`;
}
function xhtml(title: string, lang: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xml(
    lang
  )}" lang="${xml(lang)}"><head><meta charset="UTF-8"/><title>${xml(
    title
  )}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${body}</body></html>`;
}
function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
}
function css(value: string): string {
  return value.replace(/[{}<>;]/g, "") || "serif";
}
