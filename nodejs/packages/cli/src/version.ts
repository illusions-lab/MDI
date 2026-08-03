import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const PACKAGE_NAME = "@illusions-lab/mdi-cli";
const REGISTRY_URL = `https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface VersionCache {
  registryUrl: string;
  checkedAt: string;
  latestVersion: string;
}

export interface VersionServiceOptions {
  registryUrl?: string;
  cacheFile?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

export function currentVersion(): string {
  const packagePath = require.resolve("../package.json");
  delete require.cache[packagePath];
  return String(require(packagePath).version);
}

export function compareVersions(left: string, right: string): number {
  const parse = (value: string) => {
    const [corePart, prePart] = value.replace(/^v/, "").split("-");
    return { core: corePart.split("+")[0].split(".").map(Number), pre: prePart?.split(".") };
  };
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < 3; i += 1) {
    const difference = (a.core[i] || 0) - (b.core[i] || 0);
    if (difference) return difference > 0 ? 1 : -1;
  }
  if (!a.pre && !b.pre) return 0;
  if (!a.pre) return 1;
  if (!b.pre) return -1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i += 1) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    if (a.pre[i] === b.pre[i]) continue;
    const aNumeric = /^\d+$/.test(a.pre[i]);
    const bNumeric = /^\d+$/.test(b.pre[i]);
    if (aNumeric && bNumeric) return Number(a.pre[i]) > Number(b.pre[i]) ? 1 : -1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a.pre[i] > b.pre[i] ? 1 : -1;
  }
  return 0;
}

export function defaultCacheFile(): string {
  const base = process.env.XDG_CACHE_HOME || (process.platform === "win32"
    ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
    : process.platform === "darwin" ? join(homedir(), "Library", "Caches") : join(homedir(), ".cache"));
  return join(base, "mdi", "update-check.json");
}

export async function latestVersion(options: VersionServiceOptions = {}): Promise<string> {
  const registryUrl = options.registryUrl || REGISTRY_URL;
  const cacheFile = options.cacheFile || defaultCacheFile();
  const now = options.now || Date.now;
  try {
    const cached = JSON.parse(await readFile(cacheFile, "utf8")) as VersionCache;
    if (cached.registryUrl === registryUrl && now() - Date.parse(cached.checkedAt) < CACHE_TTL_MS && cached.latestVersion) {
      return cached.latestVersion;
    }
  } catch { /* cache misses are expected */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 1500);
  try {
    const response = await (options.fetchImpl || fetch)(registryUrl, {
      headers: { accept: "application/vnd.npm.install-v1+json" }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`registry returned HTTP ${response.status}`);
    const metadata = await response.json() as { "dist-tags"?: { latest?: string } };
    const version = metadata["dist-tags"]?.latest;
    if (!version) throw new Error("registry response did not include dist-tags.latest");
    const record: VersionCache = { registryUrl, checkedAt: new Date(now()).toISOString(), latestVersion: version };
    try { await mkdir(dirname(cacheFile), { recursive: true }); await writeFile(cacheFile, `${JSON.stringify(record)}\n`); } catch { /* cache is optional */ }
    return version;
  } finally {
    clearTimeout(timer);
  }
}

export async function installLatest(options: { spawnImpl?: typeof spawn } = {}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = (options.spawnImpl || spawn)("npm", ["install", "--global", `${PACKAGE_NAME}@latest`], { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`npm install exited with status ${code ?? 1}`)));
  });
}

export { PACKAGE_NAME, REGISTRY_URL, CACHE_TTL_MS };
