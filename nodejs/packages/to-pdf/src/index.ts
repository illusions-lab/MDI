import { settleMdiPrintLayout, type MdiWarichuSettleOptions } from "@illusions-lab/mdi";
export { settleMdiPrintLayout } from "@illusions-lab/mdi";
import { chromium, type Browser } from "playwright";
import type { Root } from "mdast";
import { mdiToHtml } from "@illusions-lab/mdi-to-html";
import type { ExportProfile } from "@illusions-lab/mdi-export-profile";
import { prepareChromiumPrintProfile } from "./profile.js";

export { applyPdfProfile, prepareChromiumPrintProfile } from "./profile.js";
export type { ChromiumPrintPageNumber, ChromiumPrintProfile } from "./profile.js";

export const MDI_SPEC_VERSION = "2.1";

/** Upper bound for launch, layout, print, and process exit. */
const DEFAULT_PDF_DEADLINE_MS = 120_000;

export interface RenderHtmlToPdfOptions extends MdiWarichuSettleOptions {
  /** Time limit for the whole Chromium lifecycle. The browser process is closed when it expires. */
  deadlineMs?: number;
}

/**
 * Print a complete, already-rendered MDI HTML document through Chromium.
 *
 * This is deliberately a layout adapter: callers must obtain the HTML from
 * the Rust core and must not supply an alternative MDI parser or renderer.
 * The document navigation is the only request Chromium may make. Any other
 * network or file request fails the export, and the browser process is closed
 * on success, failure, and timeout.
 */
export async function renderHtmlToPdf(
  html: string,
  profile?: ExportProfile,
  sourceWritingMode?: unknown,
  options?: RenderHtmlToPdfOptions
): Promise<Buffer> {
  const deadlineMs = options?.deadlineMs ?? DEFAULT_PDF_DEADLINE_MS;
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) {
    throw new RangeError("deadlineMs must be a positive number");
  }
  const settleOptions: MdiWarichuSettleOptions = {
    timeoutMs: options?.timeoutMs,
    signal: options?.signal,
  };
  const prepared = prepareChromiumPrintProfile(html, profile, sourceWritingMode);
  let browser: Browser | undefined;
  let rejectDeadline: (error: Error) => void = () => undefined;
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  const timer = setTimeout(() => rejectDeadline(new Error("PDF export timed out")), deadlineMs);
  const launch = chromium.launch({ headless: true }).then((launched) => {
    browser = launched;
    return launched;
  });
  const work = launch.then(async (launched) => {
        const page = await launched.newPage();
        page.setDefaultTimeout(deadlineMs);
        // Offline covers URLs that Playwright's route hook does not see, including
        // ones with userinfo. The request listener still fails the export.
        await page.context().setOffline(true);
        let blocked: string | undefined;
        const note = (url: string): void => {
          blocked ??= resourceLabel(url);
        };
        page.on("request", (request) => {
          const documentNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame();
          if (!documentNavigation) note(request.url());
        });
        await page.route("**/*", async (route) => {
          const request = route.request();
          const documentNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame();
          if (documentNavigation) {
            await route.continue();
            return;
          }
          note(request.url());
          await route.abort("blockedbyclient");
        });
        await page.setContent(prepared.html, { waitUntil: "load" });
        if (blocked !== undefined) {
          throw new Error(`PDF export blocked a resource request: ${blocked}`);
        }
        await page.emulateMedia({ media: "print" });
        await settleMdiPrintLayout((code) => page.evaluate(code), { ...settleOptions, page: prepared.page });
        const pdf = Buffer.from(
          await page.pdf({
            preferCSSPageSize: true,
            printBackground: true,
            margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
            displayHeaderFooter: prepared.pageNumbers.enabled,
            headerTemplate: prepared.pageNumbers.headerTemplate ?? "<span></span>",
            footerTemplate: prepared.pageNumbers.footerTemplate ?? "<span></span>",
          })
        );
        if (blocked !== undefined) {
          throw new Error(`PDF export blocked a resource request: ${blocked}`);
        }
        return pdf;
  });
  void work.catch(() => undefined);
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
    const instance = browser ?? await launch.catch(() => undefined);
    await closeBrowser(instance);
  }
}

async function closeBrowser(browser: Browser | undefined): Promise<void> {
  if (browser === undefined) return;
  const pid = (browser as { process?: () => { pid?: number } | null }).process?.()?.pid;
  await browser.close().catch(() => undefined);
  if (pid === undefined) return;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!processAlive(pid)) return;
    await delay(50);
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (errorCode(error) === "ESRCH") return;
    throw error;
  }
  await delay(200);
  if (processAlive(pid)) throw new Error("PDF export left a Chromium process running");
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (errorCode(error) === "ESRCH") return false;
    throw error;
  }
}

function errorCode(error: unknown): string | undefined {
  return error !== null && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}

function resourceLabel(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return value;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
