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
  /**
   * Replacement for Playwright's browser launch. Tests use this to prove a
   * deadline does not wait on a launch that never settles.
   */
  launchBrowser?: (timeoutMs: number) => Promise<Browser>;
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
  assertSelfContainedHtml(prepared.html);
  let browser: Browser | undefined;
  let rejectDeadline: (error: Error) => void = () => undefined;
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  const timer = setTimeout(() => rejectDeadline(new Error("PDF export timed out")), deadlineMs);
  const launchBrowser = options?.launchBrowser ?? ((timeoutMs: number) => chromium.launch({ headless: true, timeout: timeoutMs }));
  const launch = launchBrowser(deadlineMs).then((launched) => {
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
    if (browser !== undefined) {
      await closeBrowser(browser);
    } else {
      // A launch that is still pending must not hold the deadline. Close it if it later succeeds.
      void launch.then((launched) => closeBrowser(launched)).catch(() => undefined);
    }
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
  const schemeRelative = value.startsWith("//");
  const candidate = schemeRelative ? `https:${value}` : value;
  try {
    const url = new URL(candidate);
    url.username = "";
    url.password = "";
    const text = url.toString();
    return schemeRelative ? text.slice("https:".length) : text;
  } catch {
    return value.replace(
      /^((?:[a-zA-Z][a-zA-Z0-9+.-]*:)?\/\/)([^/?#]*)/,
      (_match, prefix: string, authority: string) => {
        const at = authority.lastIndexOf("@");
        return at < 0 ? `${prefix}${authority}` : `${prefix}${authority.slice(at + 1)}`;
      },
    );
  }
}

const RESOURCE_TAGS = new Set([
  "img", "image", "source", "iframe", "embed", "object", "link", "use", "script", "video", "audio",
]);
const RESOURCE_ATTRIBUTES = new Set(["src", "href", "data", "srcset"]);
const MAX_SVG_DEPTH = 4;

/**
 * Reject file, network, and relative subresources before Chromium parses the document.
 * Document anchors are not subresources. A `data:image/svg+xml` payload is scanned again.
 */
function assertSelfContainedHtml(html: string): void {
  scanMarkup(html, 0);
}

function scanMarkup(html: string, depth: number): void {
  if (depth > MAX_SVG_DEPTH) rejectResource("data:image/svg+xml");
  let index = 0;
  while (index < html.length) {
    const start = html.indexOf("<", index);
    if (start < 0) break;
    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      index = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", start) || html.startsWith("<?", start) || html.startsWith("</", start)) {
      const end = html.indexOf(">", start + 2);
      index = end < 0 ? html.length : end + 1;
      continue;
    }
    const tag = readTag(html, start);
    if (tag === undefined) {
      index = start + 1;
      continue;
    }
    inspectTag(tag, depth);
    const name = localName(tag.name);
    if (name === "style" || name === "script") {
      const boundary = endTagBoundary(html, tag.end, name);
      if (name === "style") scanCss(html.slice(tag.end, boundary.contentEnd), depth);
      index = boundary.resume;
      continue;
    }
    index = tag.end;
  }
}

function inspectTag(tag: MarkupTag, depth: number): void {
  const name = localName(tag.name);
  for (const attribute of tag.attributes) {
    const attributeName = localName(attribute.name);
    const value = decodeHtmlAttribute(attribute.value);
    if (attributeName === "style") scanCss(value, depth);
    if (attributeName === "srcdoc") scanMarkup(value, depth);
    if (!RESOURCE_TAGS.has(name) || !RESOURCE_ATTRIBUTES.has(attributeName)) continue;
    const candidates = attributeName === "srcset" ? srcsetCandidates(value) : [value];
    for (const candidate of candidates) vetResource(candidate, depth);
  }
}

function vetResource(url: string, depth: number): void {
  const value = url.trim();
  if (value.startsWith("#")) return;
  if (/^data:/i.test(value)) {
    vetDataUrl(value, depth);
    return;
  }
  rejectResource(value);
}

function vetDataUrl(value: string, depth: number): void {
  const comma = value.indexOf(",");
  if (comma < 0) rejectResource(value);
  const header = value.slice(0, comma);
  if (!/^data:/i.test(header)) rejectResource(value);
  if (!/^data:image\/svg\+xml\b/i.test(header)) return;
  const payload = value.slice(comma + 1);
  let text: string;
  try {
    const bytes = /;base64/i.test(header)
      ? decodeBase64(payload)
      : Buffer.from(decodeURIComponent(payload), "utf8");
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    rejectResource(value);
  }
  scanMarkup(text, depth + 1);
}

function decodeBase64(payload: string): Uint8Array {
  const compact = payload.replace(/\s/g, "");
  if (compact.length === 0 || /[^A-Za-z0-9+/=]/.test(compact)) {
    throw new Error("invalid base64");
  }
  return Buffer.from(compact, "base64");
}

function scanCss(css: string, depth: number): void {
  for (const url of cssResourceUrls(css)) vetResource(url, depth);
}

function cssResourceUrls(css: string): string[] {
  const urls: string[] = [];
  const lower = css.toLowerCase();
  let index = 0;
  while (index < css.length) {
    const at = lower.indexOf("url(", index);
    const imported = lower.indexOf("@import", index);
    if (at < 0 && imported < 0) break;
    if (imported >= 0 && (at < 0 || imported < at)) {
      const quoted = readQuoted(css, imported + "@import".length);
      if (quoted !== undefined) urls.push(quoted.value);
      index = quoted === undefined ? imported + "@import".length : quoted.end;
      continue;
    }
    const body = readCssUrlBody(css, at + 4);
    if (body === undefined) break;
    urls.push(body.value);
    index = body.end;
  }
  return urls;
}

function readCssUrlBody(css: string, start: number): { value: string; end: number } | undefined {
  let index = start;
  while (index < css.length && /\s/.test(css[index] ?? "")) index += 1;
  if (index >= css.length) return undefined;
  const quote = css[index];
  if (quote === "'" || quote === '"') {
    const end = css.indexOf(quote, index + 1);
    if (end < 0) return { value: css.slice(index + 1), end: css.length };
    return { value: css.slice(index + 1, end), end };
  }
  const valueStart = index;
  let depth = 1;
  while (index < css.length && depth > 0) {
    const character = css[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    if (depth > 0) index += 1;
  }
  return { value: css.slice(valueStart, index).trim(), end: Math.min(css.length, index + 1) };
}

function readQuoted(css: string, start: number): { value: string; end: number } | undefined {
  let index = start;
  while (index < css.length && /\s/.test(css[index] ?? "")) index += 1;
  const quote = css[index];
  if (quote !== "'" && quote !== '"') return undefined;
  const end = css.indexOf(quote, index + 1);
  if (end < 0) return { value: css.slice(index + 1), end: css.length };
  return { value: css.slice(index + 1, end), end };
}

function srcsetCandidates(value: string): string[] {
  const candidates: string[] = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && /[\s,]/.test(value[index] ?? "")) index += 1;
    if (index >= value.length) break;
    const start = index;
    if (value.slice(index).toLowerCase().startsWith("data:")) {
      while (index < value.length && !/\s/.test(value[index] ?? "")) index += 1;
      candidates.push(value.slice(start, index));
      while (index < value.length && value[index] !== ",") index += 1;
      continue;
    }
    while (index < value.length && !/[\s,]/.test(value[index] ?? "")) index += 1;
    candidates.push(value.slice(start, index));
    while (index < value.length && value[index] !== ",") index += 1;
  }
  return candidates;
}

interface MarkupTag {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  end: number;
}

function readTag(html: string, start: number): MarkupTag | undefined {
  if (html[start] !== "<") return undefined;
  let index = start + 1;
  const nameStart = index;
  while (index < html.length && /[A-Za-z0-9:_-]/.test(html[index] ?? "")) index += 1;
  if (index === nameStart) return undefined;
  const name = html.slice(nameStart, index);
  const attributes: Array<{ name: string; value: string }> = [];
  while (index < html.length) {
    while (index < html.length && /\s/.test(html[index] ?? "")) index += 1;
    if (index >= html.length) break;
    if (html[index] === ">") return { name, attributes, end: index + 1 };
    if (html[index] === "/" && html[index + 1] === ">") return { name, attributes, end: index + 2 };
    const attributeStart = index;
    while (index < html.length && /[A-Za-z0-9:_-]/.test(html[index] ?? "")) index += 1;
    if (index === attributeStart) {
      index += 1;
      continue;
    }
    const attributeName = html.slice(attributeStart, index);
    while (index < html.length && /\s/.test(html[index] ?? "")) index += 1;
    let value = "";
    if (html[index] === "=") {
      index += 1;
      while (index < html.length && /\s/.test(html[index] ?? "")) index += 1;
      const quote = html[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const valueStart = index;
        while (index < html.length && html[index] !== quote) index += 1;
        value = html.slice(valueStart, index);
        if (index < html.length) index += 1;
      } else {
        const valueStart = index;
        while (index < html.length && !/[\s>\/]/.test(html[index] ?? "")) index += 1;
        value = html.slice(valueStart, index);
      }
    }
    attributes.push({ name: attributeName, value });
  }
  return { name, attributes, end: index };
}

/** Style and script bodies stop before their end tag. The scan resumes after it. */
function endTagBoundary(html: string, start: number, name: string): { contentEnd: number; resume: number } {
  const at = html.toLowerCase().indexOf(`</${name}`, start);
  if (at < 0) return { contentEnd: html.length, resume: html.length };
  const end = html.indexOf(">", at);
  if (end < 0) return { contentEnd: at, resume: html.length };
  return { contentEnd: at, resume: end + 1 };
}

function localName(name: string): string {
  const colon = name.lastIndexOf(":");
  return (colon >= 0 ? name.slice(colon + 1) : name).toLowerCase();
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => character(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits: string) => character(Number.parseInt(digits, 10)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function character(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  return String.fromCodePoint(code);
}

function rejectResource(url: string): never {
  throw new Error(`PDF export blocked a resource request: ${resourceLabel(url)}`);
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
