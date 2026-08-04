import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, firefox, webkit } from "playwright";
import { build } from "vite";
import { packPublishablePackage } from "./pack-publishable-package.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const outputDirectory = await mkdtemp(join(tmpdir(), "mdi-browser-wasm-"));
const consumerDirectory = join(outputDirectory, "consumer");
const fixtureRoot = join(consumerDirectory, "browser");
const allBrowserTypes = [
  ["Chromium", chromium],
  ["Firefox", firefox],
  ["WebKit", webkit],
];
const requestedEngines = new Set((process.env.MDI_BROWSER_ENGINES ?? "Chromium,Firefox,WebKit").split(","));
const browserTypes = allBrowserTypes.filter(([name]) => requestedEngines.has(name));
assert(browserTypes.length > 0, "MDI_BROWSER_ENGINES must select at least one browser");
const runRetry = process.env.MDI_BROWSER_RETRY !== "0";
const wasmRequests = [];
let retryFailureRemaining = 0;

try {
  // Exercise the exact npm payload a browser user installs, not workspace
  // symlinks.  This catches export-map and relative-WASM-path regressions.
  const artifactsDirectory = join(outputDirectory, "artifacts");
  await mkdir(artifactsDirectory);
  const packagesDirectory = resolve(repositoryRoot, "nodejs/packages");
  const tarballs = (await readdir(packagesDirectory)).filter((name) =>
    existsSync(join(packagesDirectory, name, "package.json")),
  ).map((name) => packPublishablePackage({
    packageDirectory: join(packagesDirectory, name),
    workspaceRoot: resolve(repositoryRoot, "nodejs"),
    outputDirectory: artifactsDirectory,
  }));
  await mkdir(fixtureRoot, { recursive: true });
  await writeFile(join(consumerDirectory, "package.json"), JSON.stringify({ name: "mdi-packed-browser-consumer", private: true, type: "module" }));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs], { cwd: consumerDirectory, stdio: "inherit" });
  const consumerRequire = createRequire(join(consumerDirectory, "package.json"));
  const packedMdi = await import(pathToFileURL(consumerRequire.resolve("@illusions-lab/mdi")).href);
  await writeFile(join(fixtureRoot, "index.html"), await readFile(resolve(repositoryRoot, "nodejs/browser-test/index.html")));
  await writeFile(join(fixtureRoot, "src.ts"), await readFile(resolve(repositoryRoot, "nodejs/browser-test/src.ts")));

  const originalDirectory = process.cwd();
  process.chdir(fixtureRoot);
  try {
    await build({
      configFile: false,
      root: ".",
      logLevel: "error",
      base: "/mdi-editor/",
      build: { outDir: "dist", emptyOutDir: true },
    });
  } finally {
    process.chdir(originalDirectory);
  }

  const siteDirectory = join(fixtureRoot, "dist");
  const files = await listFiles(siteDirectory);
  assert(files.some((file) => file.endsWith(".wasm")), "Vite output must include the MDI WASM asset");

  const javascript = (await Promise.all(
    files.filter((file) => file.endsWith(".js")).map((file) => readFile(file, "utf8")),
  )).join("\n");
  for (const forbidden of ["node:fs", "node:path", "__dirname", "readFileSync(", "require("]) {
    assert(!javascript.includes(forbidden), `browser bundle must not contain ${forbidden}`);
  }

  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const withoutBase = pathname.startsWith("/mdi-editor/") ? pathname.slice("/mdi-editor/".length) : "";
      const requested = withoutBase === "" ? "index.html" : withoutBase;
      const file = resolve(siteDirectory, requested);
      assert(file.startsWith(`${siteDirectory}/`), "request escaped browser test output");
      if (extname(file) === ".wasm") {
        wasmRequests.push({ pathname, contentType: contentType(file) });
        if (retryFailureRemaining > 0) {
          retryFailureRemaining -= 1;
          // A dropped connection exercises an actual first-load transport
          // failure without allowing a browser's HTTP cache to retain a 503.
          response.destroy();
          return;
        }
      }
      const body = await readFile(file);
      response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/mdi-editor/`;
    console.log("Running packed browser WASM contract in Chromium, Firefox, and WebKit");
    for (const [browserName, browserType] of browserTypes) {
      await testBrowser(browserName, browserType, url, packedMdi.getMdiTextBlocks, runRetry && browserName === "Chromium" ? `${url}?retry=1` : undefined);
    }
    assert.equal(wasmRequests.length, browserTypes.length + (runRetry ? 2 : 0), "failed initialization must retry exactly once without duplicate concurrent loads");
    assert(wasmRequests.every(({ contentType }) => contentType === "application/wasm"), "WASM must be served with application/wasm");
    console.log("✓ packed WASM asset URL, MIME type, single-flight retry, and browser corpus");
  } finally {
    await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  }
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}

async function testBrowser(browserName, browserType, url, getNodeProjection, retryUrl) {
  console.log(`Launching ${browserName}`);
  const browser = await browserType.launch({ headless: true });
  try {
    await testPage(browserName, await browser.newPage(), url, getNodeProjection);
    if (retryUrl) {
      retryFailureRemaining = 1;
      await testPage(`${browserName} retry`, await browser.newPage(), retryUrl, getNodeProjection);
    }
  } finally {
    await browser.close();
  }
}

async function testPage(browserName, page, url, getNodeProjection) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(
      () => document.querySelector("#result")?.textContent !== "pending",
      undefined,
      { timeout: 5_000 },
  ).catch(() => assert.fail(
      `${browserName}: ${pageErrors.map((error) => error.stack).join("\n") || "browser test did not finish"}`,
  ));
  const result = JSON.parse(await page.locator("#result").textContent());
  assert.equal(result.error, undefined, `${browserName}: ${result.error}`);
  assert.equal(result.irVersion, "1.0", browserName);
  assert.equal(result.projectionVersion, "1.0", browserName);
  assert.equal(
    result.projectionJson,
    JSON.stringify(getNodeProjection(result.projectionSource)),
    `${browserName}: Node and browser must return byte-for-byte identical projection JSON`,
  );
  assert.equal(
    result.recoveryProjectionJson,
    JSON.stringify(getNodeProjection(result.recoverySource)),
    `${browserName}: malformed recovery must match Node without trapping Wasm`,
  );
  assert.equal(result.recoveryDiagnostic?.code, "mdi.parser.recovered", browserName);
  assert.equal(result.projectedBlocks[0]?.kind, "heading", browserName);
  assert.equal(result.projectedBlocks[0]?.range?.start, "1:1", browserName);
  assert.equal(result.firstNode, "heading", browserName);
  assert.equal(result.hasFrontmatter, true, browserName);
  assert.equal(result.tableType, "table", browserName);
  assert(result.utf8Span?.endByte > result.utf8Span?.startByte, `${browserName}: UTF-8 source span missing`);
  assert(result.largeNodeCount > 200, `${browserName}: large document was truncated`);
  assert.equal(result.diagnostic?.code, "mdi.version.unsupported", `${browserName}: diagnostics missing`);
  assert(result.diagnostic?.span?.endByte > result.diagnostic?.span?.startByte, `${browserName}: diagnostic span missing`);
  assert.match(result.canonical, /\{東京\|とうきょう\}/, browserName);
  assert.match(result.remarkOutput, /\{東京\|とうきょう\}/, browserName);
  console.log(`✓ ${browserName}: initialize, parse, serialize, and remark`);
}

async function listFiles(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const file = join(directory, entry);
    files.push((await stat(file)).isDirectory() ? await listFiles(file) : file);
  }
  return files.flat();
}

function contentType(file) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".wasm": "application/wasm",
  }[extname(file)] ?? "application/octet-stream";
}
