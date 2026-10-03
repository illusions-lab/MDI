import { describe, expect, it } from "vitest";
import { createMdiCoreRuntime, MdiCoreNotInitializedError } from "./runtime.js";

describe("browser MDI core runtime", () => {
  it("rejects synchronous calls before initialization", () => {
    expect(() => createMdiCoreRuntime(() => {}).requireInitialized()).toThrow(MdiCoreNotInitializedError);
  });

  it("shares one promise while initializing and after completion", async () => {
    let calls = 0;
    let release;
    const runtime = createMdiCoreRuntime(() => {
      calls += 1;
      return new Promise((resolve) => { release = resolve; });
    });
    const first = runtime.initialize();
    const second = runtime.initialize();
    expect(second).toBe(first);
    await Promise.resolve();
    expect(calls).toBe(1);
    release();
    await first;
    expect(runtime.initialize()).toBe(first);
    expect(() => runtime.requireInitialized()).not.toThrow();
  });

  it("clears failed initialization and permits a successful retry", async () => {
    let calls = 0;
    const runtime = createMdiCoreRuntime(() => {
      calls += 1;
      if (calls === 1) throw new Error("network failure");
    });
    await expect(runtime.initialize()).rejects.toThrow("network failure");
    expect(() => runtime.requireInitialized()).toThrow(MdiCoreNotInitializedError);
    await expect(runtime.initialize()).resolves.toBeUndefined();
    expect(calls).toBe(2);
    expect(() => runtime.requireInitialized()).not.toThrow();
  });
});
