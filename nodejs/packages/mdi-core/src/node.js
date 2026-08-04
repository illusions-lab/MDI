// Node wasm-pack bindings instantiate synchronously at module evaluation.
// Keep the portable facade API while preserving Node's eager behavior.
export * from "../generated/node/mdi_core.js";
export class MdiCoreNotInitializedError extends Error {}
const initialization = Promise.resolve();
export function initializeMdiCore() {
  return initialization;
}
