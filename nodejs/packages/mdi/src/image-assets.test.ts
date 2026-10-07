import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { imageUrls, renderHtml, renderText, renderTextFormat } from "./index.js";
import { loadImageAssets } from "./image-assets.js";
import { preparePdfExport } from "./node.js";

const png = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	"base64",
);

function response(body: BodyInit | null, init?: ResponseInit): Response {
	return new Response(body, init);
}

describe("imageUrls", () => {
	it("lists reference-resolved urls once, including data urls", () => {
		const source = "![a](a.png)\n\n![b][ref]\n\n[ref]: a.png\n\n![](data:image/png;base64,aaaa)\n";
		expect(imageUrls(source)).toEqual(["a.png", "data:image/png;base64,aaaa"]);
	});
});

describe("loadImageAssets", () => {
	it("reads relative paths, parent paths, spaces, unicode, and file urls", async () => {
		const root = await mkdtemp(join(tmpdir(), "mdi-images-"));
		const directory = join(root, "manuscript");
		try {
			await mkdir(directory);
			await writeFile(join(directory, "a b.png"), png);
			await writeFile(join(directory, "図.png"), png);
			await writeFile(join(directory, "a.png?x=1"), png);
			await writeFile(join(root, "outside.png"), png);
			const fileUrl = pathToFileURL(join(directory, "a b.png")).href;
			const source = [
				"![](<a b.png>)",
				"![](図.png)",
				"![](<a.png?x=1>)",
				`![](${fileUrl})`,
				"![](../outside.png)",
			].join("\n\n");
			const assets = await loadImageAssets(source, {
				directory,
				fetch: () => { throw new Error("fetch must not run for local files"); },
			});
			expect(Object.keys(assets).sort()).toEqual([fileUrl, "../outside.png", "a b.png", "a.png?x=1", "図.png"].sort());
			for (const asset of Object.values(assets)) {
				expect(asset.mediaType).toBe("application/octet-stream");
				expect(Buffer.from(asset.data)).toEqual(png);
			}
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("fetches scheme-relative urls as https and keeps the manuscript key", async () => {
		const seen: string[] = [];
		const assets = await loadImageAssets("![](//assets.example/a.png)", {
			directory: "/tmp",
			fetch: async (input) => {
				seen.push(String(input));
				return response(png);
			},
		});
		expect(seen).toEqual(["https://assets.example/a.png"]);
		expect(assets["//assets.example/a.png"]?.data).toEqual(new Uint8Array(png));
	});

	it("follows five redirects and rejects a sixth or a file redirect", async () => {
		const hops = ["https://example.test/0", "https://example.test/1", "https://example.test/2", "https://example.test/3", "https://example.test/4", "https://example.test/5"];
		const assets = await loadImageAssets("![](https://example.test/0)", {
			directory: "/tmp",
			fetch: async (input) => {
				const index = hops.indexOf(String(input));
				if (index < 5) return response(null, { status: 302, headers: { location: hops[index + 1]! } });
				return response(png);
			},
		});
		expect(assets["https://example.test/0"]?.data).toEqual(new Uint8Array(png));

		await expect(loadImageAssets("![](https://example.test/0)", {
			directory: "/tmp",
			fetch: async (input) => {
				const index = hops.indexOf(String(input));
				const next = index >= 5 ? "https://example.test/6" : hops[index + 1]!;
				return response(null, { status: 302, headers: { location: next } });
			},
		})).rejects.toThrow("followed more than 5 redirects");

		await expect(loadImageAssets("![](https://example.test/start)", {
			directory: "/tmp",
			fetch: async () => response(null, { status: 302, headers: { location: "file:///etc/passwd" } }),
		})).rejects.toThrow("redirect left http(s)");
	});

	it("stops a stream that exceeds the byte limit and reports a timeout", async () => {
		let pulls = 0;
		let cancelled = false;
		await expect(loadImageAssets("![](https://example.test/big.png)", {
			directory: "/tmp",
			maxBytes: 150,
			fetch: async () => response(new ReadableStream({
				pull(controller) {
					pulls += 1;
					controller.enqueue(new Uint8Array(100));
				},
				cancel() { cancelled = true; },
			})),
		})).rejects.toThrow("exceeds the 150 byte limit");
		expect(cancelled).toBe(true);
		expect(pulls).toBeLessThan(5);

		await expect(loadImageAssets("![](https://example.test/slow.png)", {
			directory: "/tmp",
			timeoutMs: 20,
			fetch: (_input, init) => new Promise((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
			}),
		})).rejects.toThrow("timed out");
	});

	it("fetches loopback and private urls and rejects ftp and javascript", async () => {
		const seen: string[] = [];
		const source = "![](http://127.0.0.1/a.png)\n\n![](http://10.0.0.8/b.png)";
		const assets = await loadImageAssets(source, {
			directory: "/tmp",
			fetch: async (input) => {
				seen.push(String(input));
				return response(png);
			},
		});
		expect(seen).toEqual(["http://127.0.0.1/a.png", "http://10.0.0.8/b.png"]);
		expect(Object.keys(assets)).toHaveLength(2);

		const rejected = loadImageAssets("![](ftp://example.test/a.png)\n\n![](javascript:alert(1))", {
			directory: "/tmp",
			fetch: () => { throw new Error("fetch must not run"); },
		});
		await expect(rejected).rejects.toThrow(/unsupported URL scheme ftp/);
		await expect(rejected).rejects.toThrow(/unsupported URL scheme javascript/);
	});

	it("omits credentials from errors and leaves data urls for the core", async () => {
		const statusError = await loadImageAssets("![](https://alice:s3cret-token@example.test/a.png)", {
			directory: "/tmp",
			fetch: async () => response("no", { status: 401 }),
		}).then(() => "", (error: Error) => error.message);
		expect(statusError).toContain("https://example.test/a.png");
		expect(statusError).not.toMatch(/alice|s3cret-token/);
		const thrown = await loadImageAssets("![](https://alice:s3cret-token@example.test/a.png)", {
			directory: "/tmp",
			fetch: async () => { throw new Error("failed https://alice:s3cret-token@example.test/a.png"); },
		}).then(() => "", (error: Error) => error.message);
		expect(thrown).not.toMatch(/alice|s3cret-token/);

		const source = "![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=)";
		const assets = await loadImageAssets(source, {
			directory: "/tmp",
			fetch: () => { throw new Error("fetch must not run"); },
		});
		expect(assets).toEqual({});
		const html = renderHtml(source, { assets });
		expect(html).toContain("data:image/png;base64,");
		expect(html).toContain('width="1"');
	});
});

describe("self-contained render boundary", () => {
	it("keeps source urls until assets are passed, including an empty map", () => {
		const source = "![alt](pic.png)";
		expect(renderHtml(source)).toContain('src="pic.png"');
		expect(() => renderHtml(source, { assets: {} })).toThrow(/pic\.png/);
		const html = renderHtml(source, { assets: { "pic.png": { data: png, mediaType: "application/octet-stream" } } });
		expect(html).toContain("data:image/png;base64,");
		expect(html).not.toContain("pic.png");
		expect(html).toContain('alt="alt"');
	});

	it("leaves text and note export unchanged", () => {
		const source = "![alt](pic.png)";
		expect(renderText(source)).toContain("alt");
		expect(renderTextFormat(source, "note")).not.toContain("data:image");
	});

	it("preparePdfExport keeps the source url unless assets are supplied", () => {
		const source = "![alt](pic.png)";
		expect(preparePdfExport(source).html).toContain('src="pic.png"');
		const prepared = preparePdfExport(source, undefined, {
			"pic.png": { data: png, mediaType: "application/octet-stream" },
		});
		expect(prepared.html).toContain("data:image/png;base64,");
		expect(prepared.html).not.toContain("pic.png");
	});
});
