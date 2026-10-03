import { cp, mkdir, rename } from "node:fs/promises";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const dist = resolve(packageRoot, "dist");
const generated = resolve(dist, "generated");

await mkdir(generated, { recursive: true });
for (const target of ["node", "web"]) {
  await rename(resolve(dist, target), resolve(generated, target));
  await mkdir(resolve(dist, target), { recursive: true });
}
await cp(resolve(packageRoot, "src/node.cjs"), resolve(dist, "node/index.cjs"));
await cp(resolve(packageRoot, "src/browser.js"), resolve(dist, "web/index.js"));
await cp(resolve(packageRoot, "src/runtime.js"), resolve(dist, "web/runtime.js"));
await cp(resolve(packageRoot, "src/node.d.ts"), resolve(dist, "node/index.d.ts"));
await cp(resolve(packageRoot, "src/browser.d.ts"), resolve(dist, "web/index.d.ts"));
