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

	it("strips percent-encoded passwords, redirect secrets, and file userinfo", async () => {
		const percent = await loadImageAssets("![](https://alice:100%@example.test/a.png)", {
			directory: "/tmp",
			fetch: async () => { throw new Error("failed password 100% at https://alice:100%@example.test/a.png"); },
		}).then(() => "", (error: Error) => error.message);
		expect(percent).not.toContain("100%");
		expect(percent).not.toContain("alice");
		expect(percent).toContain("example.test");

		const redirected = await loadImageAssets("![](https://example.test/start)", {
			directory: "/tmp",
			fetch: async (input) => {
				if (String(input).endsWith("/start")) {
					return response(null, { status: 302, headers: { location: "https://bob:other-secret@example.test/next" } });
				}
				throw new Error(`failed at ${String(input)} and https://bob:other-secret@example.test/next`);
			},
		}).then(() => "", (error: Error) => error.message);
		expect(redirected).not.toContain("other-secret");
		expect(redirected).not.toContain("bob");
		expect(redirected).toContain("example.test");

		const fileUrl = "file://alice:s3cret@localhost/no/such/image.png";
		const fileError = await loadImageAssets(`![](${fileUrl})`, {
			directory: "/tmp",
			fetch: async () => { throw new Error(`fetch must not run ${fileUrl}`); },
		}).then(() => "", (error: Error) => error.message);
		expect(fileError).not.toMatch(/alice|s3cret/);
	});

	it("loads at most four images at once and reuses one timeout across redirects", async () => {
		let active = 0;
		let maxActive = 0;
		const source = Array.from({ length: 6 }, (_, index) => `![](https://example.test/${index}.png)`).join("\n\n");
		await loadImageAssets(source, {
			directory: "/tmp",
			fetch: async () => {
				active += 1;
				maxActive = Math.max(maxActive, active);
				await new Promise((resolve) => setTimeout(resolve, 40));
				active -= 1;
				return response(png);
			},
		});
		expect(maxActive).toBe(4);

		const signals: AbortSignal[] = [];
		await Promise.race([
			loadImageAssets("![](https://example.test/start)", {
				directory: "/tmp",
				timeoutMs: 2_000,
				fetch: async (input, init) => {
					if (init?.signal) signals.push(init.signal);
					if (String(input).endsWith("/start")) {
						return response(null, { status: 302, headers: { location: "https://example.test/next" } });
					}
					return response(png);
				},
			}),
			new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error("redirects did not share one timeout")), 500);
			}),
		]);
		expect(signals).toHaveLength(2);
		expect(signals[0]).toBe(signals[1]);
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

	it("rejects a missing directory, a bad limit, and a fetch that is not a function", async () => {
		await expect(loadImageAssets("![](a.png)", undefined as never)).rejects.toThrow(
			"directory must be a non-empty string",
		);
		await expect(loadImageAssets("![](a.png)", { directory: "" })).rejects.toThrow(
			"directory must be a non-empty string",
		);
		await expect(loadImageAssets("![](a.png)", { directory: 1 as never })).rejects.toThrow(
			"directory must be a non-empty string",
		);
		await expect(loadImageAssets("text", {
			directory: "/tmp",
			timeoutMs: 0,
			fetch: async () => response(png),
		})).rejects.toThrow("timeoutMs must be a positive integer");
		await expect(loadImageAssets("text", {
			directory: "/tmp",
			timeoutMs: 1.5,
			fetch: async () => response(png),
		})).rejects.toThrow("timeoutMs must be a positive integer");
		await expect(loadImageAssets("text", {
			directory: "/tmp",
			maxBytes: 0,
			fetch: async () => response(png),
		})).rejects.toThrow("maxBytes must be a positive integer");
		await expect(loadImageAssets("text", {
			directory: "/tmp",
			maxBytes: 1.5,
			fetch: async () => response(png),
		})).rejects.toThrow("maxBytes must be a positive integer");
		await expect(loadImageAssets("text", {
			directory: "/tmp",
			fetch: 1 as never,
		})).rejects.toThrow("fetch must be a function");
	});

	it("uses global fetch when the option is omitted", async () => {
		const original = globalThis.fetch;
		const seen: string[] = [];
		globalThis.fetch = (async (input) => {
			seen.push(String(input));
			return response(png);
		}) as typeof fetch;
		try {
			const assets = await loadImageAssets("![](https://example.test/a.png)", { directory: "/tmp" });
			expect(seen).toEqual(["https://example.test/a.png"]);
			expect(assets["https://example.test/a.png"]?.data).toEqual(new Uint8Array(png));
		} finally {
			globalThis.fetch = original;
		}
	});

	it("reports an empty image url without fetching", async () => {
		let called = false;
		await expect(loadImageAssets("![]()", {
			directory: "/tmp",
			fetch: async () => {
				called = true;
				return response(png);
			},
		})).rejects.toThrow("image URL is empty");
		expect(called).toBe(false);
	});

	it("rejects a missing file, a directory, an oversized file, and a drive-letter path", async () => {
		const root = await mkdtemp(join(tmpdir(), "mdi-images-"));
		try {
			await mkdir(join(root, "dir"));
			await writeFile(join(root, "big.png"), Buffer.alloc(32));
			await expect(loadImageAssets("![](missing.png)", {
				directory: root,
				fetch: async () => { throw new Error("fetch must not run"); },
			})).rejects.toThrow("file not found");
			await expect(loadImageAssets("![](dir)", {
				directory: root,
				fetch: async () => { throw new Error("fetch must not run"); },
			})).rejects.toThrow("not a file");
			await expect(loadImageAssets("![](big.png)", {
				directory: root,
				maxBytes: 8,
				fetch: async () => { throw new Error("fetch must not run"); },
			})).rejects.toThrow("exceeds the 8 byte limit");
			await expect(loadImageAssets("![](C:/a.png)", {
				directory: root,
				fetch: async () => { throw new Error("fetch must not run"); },
			})).rejects.toThrow("file not found");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("stops before reading a body whose content-length is over the limit", async () => {
		let cancelled = false;
		// Node's Response drops Content-Length on a stream. A real fetch keeps it.
		const declared = {
			ok: true,
			status: 200,
			headers: new Headers({ "content-length": "100" }),
			body: {
				cancel: async () => { cancelled = true; },
				getReader() { throw new Error("body was read"); },
			},
		} as unknown as Response;
		await expect(loadImageAssets("![](https://example.test/big.png)", {
			directory: "/tmp",
			maxBytes: 10,
			fetch: async () => declared,
		})).rejects.toThrow("exceeds the 10 byte limit");
		expect(cancelled).toBe(true);
	});

	it("returns an empty body when the response has no stream", async () => {
		const assets = await loadImageAssets("![](https://example.test/empty)", {
			directory: "/tmp",
			fetch: async () => new Response(null),
		});
		expect(assets["https://example.test/empty"]?.data).toEqual(new Uint8Array());
	});

	it("rejects a redirect with no location, an empty location, or a location that is not a url", async () => {
		await expect(loadImageAssets("![](https://example.test/start)", {
			directory: "/tmp",
			fetch: async () => response(null, { status: 302 }),
		})).rejects.toThrow("redirect is missing a location");
		await expect(loadImageAssets("![](https://example.test/start)", {
			directory: "/tmp",
			fetch: async () => response(null, { status: 302, headers: { location: "" } }),
		})).rejects.toThrow("redirect is missing a location");
		await expect(loadImageAssets("![](https://example.test/start)", {
			directory: "/tmp",
			fetch: async () => response(null, { status: 302, headers: { location: "http://[" } }),
		})).rejects.toThrow("redirect location is not a URL");
	});

	it("follows every http redirect status to the next url", async () => {
		for (const status of [301, 303, 307, 308]) {
			const seen: string[] = [];
			const assets = await loadImageAssets("![](https://example.test/start)", {
				directory: "/tmp",
				fetch: async (input) => {
					seen.push(String(input));
					if (String(input).endsWith("/start")) {
						return response(null, { status, headers: { location: "https://example.test/next" } });
					}
					return response(png);
				},
			});
			expect(seen).toEqual(["https://example.test/start", "https://example.test/next"]);
			expect(assets["https://example.test/start"]?.data).toEqual(new Uint8Array(png));
		}
	});

	it("strips a username without a password and scheme-relative userinfo", async () => {
		const username = await loadImageAssets("![](https://alice@example.test/a.png)", {
			directory: "/tmp",
			fetch: async () => { throw new Error("failed at https://alice@example.test/a.png"); },
		}).then(() => "", (error: Error) => error.message);
		expect(username).not.toContain("alice");
		expect(username).toContain("example.test");

		const relative = await loadImageAssets("![](//alice:s3cret@assets.example/a.png)", {
			directory: "/tmp",
			fetch: async (input) => { throw new Error(`failed at ${String(input)}`); },
		}).then(() => "", (error: Error) => error.message);
		expect(relative).not.toMatch(/alice|s3cret/);
		expect(relative).toContain("assets.example");
	});

	it("replaces a non-error failure with a scrubbed request failed message", async () => {
		const message = await loadImageAssets("![](https://alice:s3cret@example.test/a.png)", {
			directory: "/tmp",
			fetch: async () => {
				throw "down https://alice:s3cret@example.test/a.png";
			},
		}).then(() => "", (error: Error) => error.message);
		expect(message).toContain("request failed");
		expect(message).not.toMatch(/alice|s3cret/);
	});

	it("times out while reading the body on the same signal", async () => {
		await expect(loadImageAssets("![](https://example.test/slow-body.png)", {
			directory: "/tmp",
			timeoutMs: 30,
			fetch: async (_input, init) => response(new ReadableStream({
				async pull(controller) {
					await new Promise<void>((resolve) => {
						if (init?.signal?.aborted) resolve();
						else init?.signal?.addEventListener("abort", () => resolve(), { once: true });
					});
					controller.enqueue(new Uint8Array([1]));
				},
			})),
		})).rejects.toThrow("timed out");
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
