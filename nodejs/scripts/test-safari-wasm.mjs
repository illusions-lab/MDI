// Safari.app smoke for the same packed npm consumer contract as the
// Playwright suite.  safaridriver speaks the W3C WebDriver HTTP protocol, so
// no third-party WebDriver client is needed in the published dependency set.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { build } from "vite";
import { packPublishablePackage } from "./pack-publishable-package.mjs";

const root = resolve(import.meta.dirname, "../..");
const temporary = await mkdtemp(join(tmpdir(), "mdi-safari-wasm-"));
const consumer = join(temporary, "consumer");
const fixture = join(consumer, "browser");
const port = 4444;
let driver;
let server;
let sessionId;

try {
  const artifacts = join(temporary, "artifacts");
  await mkdir(artifacts);
  const packages = resolve(root, "nodejs/packages");
  const tarballs = (await readdir(packages)).filter((name) => existsSync(join(packages, name, "package.json"))).map((name) =>
    packPublishablePackage({ packageDirectory: join(packages, name), workspaceRoot: resolve(root, "nodejs"), outputDirectory: artifacts }),
  );
  await mkdir(fixture, { recursive: true });
  await writeFile(join(consumer, "package.json"), JSON.stringify({ name: "mdi-safari-packed-consumer", private: true, type: "module" }));
  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs], consumer);
  await writeFile(join(fixture, "index.html"), await readFile(join(root, "nodejs/browser-test/index.html")));
  await writeFile(join(fixture, "src.ts"), await readFile(join(root, "nodejs/browser-test/src.ts")));

  const previous = process.cwd();
  process.chdir(fixture);
  try { await build({ configFile: false, root: ".", logLevel: "error", base: "/mdi-editor/", build: { outDir: "dist", emptyOutDir: true } }); }
  finally { process.chdir(previous); }

  const site = join(fixture, "dist");
  assert((await files(site)).some((file) => file.endsWith(".wasm")), "packed Safari fixture must emit WASM");
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const requested = pathname.startsWith("/mdi-editor/") ? pathname.slice("/mdi-editor/".length) || "index.html" : "index.html";
      const file = resolve(site, requested);
      assert(file.startsWith(`${site}/`));
      response.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm" }[extname(file)] ?? "application/octet-stream" });
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert(address && typeof address === "object");

  driver = spawn("safaridriver", ["--port", String(port)], { stdio: "ignore" });
  await waitForDriver();
  sessionId = await webdriver("POST", "/session", { capabilities: { alwaysMatch: { browserName: "safari" } } }).then((value) => value.sessionId);
  await webdriver("POST", `/session/${sessionId}/url`, { url: `http://127.0.0.1:${address.port}/mdi-editor/` });
  const result = await pollResult();
  assert.equal(result.error, undefined, result.error);
  assert.equal(result.irVersion, "1.0");
  assert.equal(JSON.parse(result.sourceResolutionJson).projectionVersion, "1.0");
  assert(JSON.parse(result.sourceResolutionJson).matches.length > 0);
  assert.equal(result.hasFrontmatter, true);
  assert.equal(result.tableType, "table");
  assert(result.utf8Span?.endByte > result.utf8Span?.startByte);
  assert(result.largeNodeCount > 200);
  assert.equal(result.diagnostic?.code, "mdi.version.unsupported");
  assert(result.diagnostic?.span?.endByte > result.diagnostic?.span?.startByte);
  assert.match(result.canonical, /\{東京\|とうきょう\}/);
  assert.match(result.remarkOutput, /\{東京\|とうきょう\}/);
  console.log("✓ Safari.app: packed initialize, parse, serialize, and remark");
} finally {
  if (sessionId) await webdriver("DELETE", `/session/${sessionId}`).catch(() => {});
  driver?.kill();
  if (server) await new Promise((done) => server.close(done));
  await rm(temporary, { recursive: true, force: true });
}

function run(command, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", reject).once("exit", (code) => code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code}`)));
  });
}
async function webdriver(method, pathname, body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) throw new Error(payload.value?.message ?? `WebDriver ${response.status}`);
  return payload.value;
}
async function waitForDriver() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { await webdriver("GET", "/status"); return; } catch { await new Promise((resolveWait) => setTimeout(resolveWait, 100)); }
  }
  throw new Error("safaridriver did not become ready");
}
async function pollResult() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await webdriver("POST", `/session/${sessionId}/execute/sync`, { script: "return document.querySelector('#result')?.textContent", args: [] });
    if (value && value !== "pending") return JSON.parse(value);
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Safari browser fixture did not finish");
}
async function files(directory) {
  const entries = await readdir(directory);
  return (await Promise.all(entries.map(async (entry) => {
    const file = join(directory, entry);
    return (await stat(file)).isDirectory() ? files(file) : [file];
  }))).flat();
}
