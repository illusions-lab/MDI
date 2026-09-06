import { settleMdiPrintLayout, type MdiWarichuSettleOptions } from "@illusions-lab/mdi";
export { settleMdiPrintLayout } from "@illusions-lab/mdi";
import { chromium } from "playwright";
import type { Root } from "mdast";
import { mdiToHtml } from "@illusions-lab/mdi-to-html";
import type { ExportProfile } from "@illusions-lab/mdi-export-profile";
import { prepareChromiumPrintProfile } from "./profile.js";

export { applyPdfProfile, prepareChromiumPrintProfile } from "./profile.js";
export type { ChromiumPrintPageNumber, ChromiumPrintProfile } from "./profile.js";

export const MDI_SPEC_VERSION = "2.0";

/**
 * Print a complete, already-rendered MDI HTML document through Chromium.
 *
 * This is deliberately a layout adapter: callers must obtain the HTML from
 * the Rust core and must not supply an alternative MDI parser or renderer.
 */
export async function renderHtmlToPdf(
  html: string,
  profile?: ExportProfile,
  sourceWritingMode?: unknown,
  options?: MdiWarichuSettleOptions
): Promise<Buffer> {
  const prepared = prepareChromiumPrintProfile(html, profile, sourceWritingMode);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(prepared.html);
    await page.emulateMedia({media:"print"});
    await settleMdiPrintLayout(code => page.evaluate(code), { ...options, page: prepared.page });
    return Buffer.from(
      await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
        displayHeaderFooter: prepared.pageNumbers.enabled,
        headerTemplate: prepared.pageNumbers.headerTemplate ?? "<span></span>",
        footerTemplate: prepared.pageNumbers.footerTemplate ?? "<span></span>",
      })
    );
  } finally {
    await browser.close();
  }
}

/** Renders an MDI document with the complete Illusions PDF export profile. */
export async function mdiToPdf(
  tree: Root,
  profile?: ExportProfile
): Promise<Buffer> {
  const sourceWritingMode = (
    tree.data as { frontmatter?: { writingMode?: unknown } } | undefined
  )?.frontmatter?.writingMode;
  return renderHtmlToPdf(mdiToHtml(tree), profile, sourceWritingMode);
}
