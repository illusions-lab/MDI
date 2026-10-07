import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { imageUrls, type MdiImageAssets } from "./index.js";

/** Default per-image fetch budget. The same limit covers every redirect of that image. */
export const DEFAULT_IMAGE_TIMEOUT_MS = 30_000;

/** Default per-image byte budget. This matches the core default. */
export const DEFAULT_MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const MAX_REDIRECTS = 5;
const LOAD_CONCURRENCY = 4;

/** Options for turning manuscript image URLs into bytes. The core does not read these URLs itself. */
export interface LoadImageAssetsOptions {
	/** Directory of this manuscript. Relative image paths resolve from here and may leave it. */
	directory: string;
	/** Per-image time limit in milliseconds, including redirects. */
	timeoutMs?: number;
	/** Per-image byte limit, enforced while the body is still streaming. */
	maxBytes?: number;
	/** Replacement for global fetch. Tests use this so they do not touch the network. */
	fetch?: typeof fetch;
}

/**
 * Read every non-`data:` Markdown image named by `source`.
 *
 * The returned map is keyed by the manuscript URL. `data:` images are omitted
 * because the core decodes them and ignores a map entry for the same URL.
 * Credentials are sent only on the retrieval request and are removed from errors.
 * The response `Content-Type` is ignored; every entry is `application/octet-stream`
 * so the core sniffs the bytes.
 */
export async function loadImageAssets(
	source: string,
	options: LoadImageAssetsOptions,
): Promise<MdiImageAssets> {
	if (typeof options?.directory !== "string" || options.directory.length === 0) {
		throw new TypeError("directory must be a non-empty string");
	}
	const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_IMAGE_TIMEOUT_MS, "timeoutMs");
	const maxBytes = positiveInteger(options.maxBytes, DEFAULT_MAX_IMAGE_BYTES, "maxBytes");
	const fetchImpl = options.fetch ?? globalThis.fetch;
	if (typeof fetchImpl !== "function") throw new TypeError("fetch must be a function");
	const assets: MdiImageAssets = {};
	const urls = imageUrls(source).filter((url) => !url.startsWith("data:"));
	const failureMessages = new Array<string | undefined>(urls.length);
	await mapLimited(urls.map((url, index) => ({ url, index })), LOAD_CONCURRENCY, async ({ url, index }) => {
		try {
			assets[url] = {
				data: await loadOne(url, options.directory, timeoutMs, maxBytes, fetchImpl),
				mediaType: "application/octet-stream",
			};
		} catch (error) {
			failureMessages[index] = `image ${JSON.stringify(resourceLabel(url))}: ${publicMessage(error, url)}`;
		}
	});
	const failures = failureMessages.filter((message): message is string => message !== undefined);
	if (failures.length > 0) {
		throw new Error(failures.join("\n"));
	}
	return assets;
}

async function loadOne(
	url: string,
	directory: string,
	timeoutMs: number,
	maxBytes: number,
	fetchImpl: typeof fetch,
): Promise<Uint8Array> {
	if (url.length === 0) throw new Error("image URL is empty");
	const scheme = urlScheme(url);
	if (scheme === "http" || scheme === "https") {
		return fetchBytes(url, timeoutMs, maxBytes, fetchImpl);
	}
	if (url.startsWith("//")) {
		return fetchBytes(`https:${url}`, timeoutMs, maxBytes, fetchImpl);
	}
	if (scheme === "file") {
		let path: string;
		try {
			path = fileURLToPath(url);
		} catch {
			throw new Error("invalid file URL");
		}
		return readLimitedFile(path, maxBytes);
	}
	if (scheme !== undefined) {
		throw new Error(`unsupported URL scheme ${scheme}`);
	}
	return readLimitedFile(resolve(directory, url), maxBytes);
}

async function fetchBytes(
	startUrl: string,
	timeoutMs: number,
	maxBytes: number,
	fetchImpl: typeof fetch,
): Promise<Uint8Array> {
	const signal = AbortSignal.timeout(timeoutMs);
	const seen = [startUrl];
	let current = startUrl;
	let redirects = 0;
	try {
		while (true) {
			let response: Response;
			try {
				response = await fetchImpl(current, { redirect: "manual", signal });
			} catch (error) {
				if (signal.aborted) throw new Error("timed out");
				throw error;
			}
			if (isRedirect(response.status)) {
				redirects += 1;
				const location = response.headers.get("location");
				await response.body?.cancel().catch(() => undefined);
				if (location !== null && location.length > 0) seen.push(location);
				if (redirects > MAX_REDIRECTS) throw new Error(`followed more than ${MAX_REDIRECTS} redirects`);
				if (location === null || location.length === 0) throw new Error("redirect is missing a location");
				let next: URL;
				try {
					next = new URL(location, current);
				} catch {
					throw new Error("redirect location is not a URL");
				}
				seen.push(next.toString());
				if (next.protocol !== "http:" && next.protocol !== "https:") {
					throw new Error("redirect left http(s)");
				}
				current = next.toString();
				continue;
			}
			if (!response.ok) throw new Error(`request failed with status ${response.status}`);
			return await readLimitedBody(response, maxBytes, signal);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "request failed";
		throw new Error(scrubSecrets(message, seen));
	}
}

async function readLimitedBody(response: Response, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
	const declared = Number(response.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > maxBytes) {
		await response.body?.cancel().catch(() => undefined);
		throw new Error(`exceeds the ${maxBytes} byte limit`);
	}
	if (response.body === null) {
		const data = new Uint8Array(await response.arrayBuffer());
		if (data.byteLength > maxBytes) throw new Error(`exceeds the ${maxBytes} byte limit`);
		return data;
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			if (signal.aborted) throw new Error("timed out");
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) throw new Error(`exceeds the ${maxBytes} byte limit`);
			chunks.push(value);
		}
	} finally {
		await reader.cancel().catch(() => undefined);
	}
	const data = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		data.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return data;
}

async function readLimitedFile(path: string, maxBytes: number): Promise<Uint8Array> {
	let info: Awaited<ReturnType<typeof stat>>;
	try {
		info = await stat(path);
	} catch {
		throw new Error("file not found");
	}
	if (!info.isFile()) throw new Error("not a file");
	if (info.size > maxBytes) throw new Error(`exceeds the ${maxBytes} byte limit`);
	const data = new Uint8Array(await readFile(path));
	if (data.byteLength > maxBytes) throw new Error(`exceeds the ${maxBytes} byte limit`);
	return data;
}

function isRedirect(status: number): boolean {
	return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function urlScheme(url: string): string | undefined {
	const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
	if (!match) return undefined;
	const scheme = match[1]!.toLowerCase();
	// A Windows drive prefix is a path, not a scheme.
	if (scheme.length === 1) return undefined;
	return scheme;
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
	if (value === undefined) return fallback;
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new RangeError(`${name} must be a positive integer`);
	}
	return value;
}

/** Manuscript URL with userinfo removed. Non-URL paths stay unchanged. */
function resourceLabel(value: string): string {
	return withoutUserinfo(value);
}

function publicMessage(error: unknown, url: string): string {
	const message = error instanceof Error ? error.message : "request failed";
	return scrubSecrets(message, [url]);
}

/** Drop credentials from every URL that was requested or named in a redirect. */
function scrubSecrets(message: string, urls: readonly string[]): string {
	let text = message;
	for (const url of urls) {
		const cleaned = withoutUserinfo(url);
		if (cleaned !== url) text = text.split(url).join(cleaned);
		const candidate = url.startsWith("//") ? `https:${url}` : url;
		const raw = rawUserinfo(candidate);
		try {
			const parsed = new URL(candidate);
			const serialized = url.startsWith("//") ? parsed.toString().slice("https:".length) : parsed.toString();
			if (serialized !== cleaned) text = text.split(serialized).join(cleaned);
			if (parsed.password) text = text.split(parsed.password).join("");
			if (parsed.username) text = text.split(parsed.username).join("");
		} catch {
			// The raw userinfo below still covers URLs the parser rejects.
		}
		if (raw?.password) text = text.split(raw.password).join("");
		if (raw?.username) text = text.split(raw.username).join("");
	}
	return text;
}

function withoutUserinfo(value: string): string {
	const schemeRelative = value.startsWith("//");
	const candidate = schemeRelative ? `https:${value}` : value;
	try {
		const url = new URL(candidate);
		url.username = "";
		url.password = "";
		const text = url.toString();
		return schemeRelative ? text.slice("https:".length) : text;
	} catch {
		// Node rejects some file URLs that still carry userinfo. Remove that
		// authority text so the password cannot survive in a label.
		return value.replace(
			/^((?:[a-zA-Z][a-zA-Z0-9+.-]*:)?\/\/)([^/?#]*)/,
			(_match, prefix: string, authority: string) => {
				const at = authority.lastIndexOf("@");
				return at < 0 ? `${prefix}${authority}` : `${prefix}${authority.slice(at + 1)}`;
			},
		);
	}
}

/** Userinfo as it appears in the URL text, before the URL parser decodes it. */
function rawUserinfo(candidate: string): { username: string; password: string } | undefined {
	const match = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?\/\/([^/?#]*)/.exec(candidate);
	if (!match) return undefined;
	const authority = match[1] ?? "";
	const at = authority.lastIndexOf("@");
	if (at < 0) return undefined;
	const userinfo = authority.slice(0, at);
	const colon = userinfo.indexOf(":");
	if (colon < 0) return { username: userinfo, password: "" };
	return { username: userinfo.slice(0, colon), password: userinfo.slice(colon + 1) };
}

async function mapLimited<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
	let next = 0;
	const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const current = next;
			next += 1;
			await worker(items[current]!);
		}
	});
	await Promise.all(runners);
}
