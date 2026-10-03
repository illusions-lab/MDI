/** Create the small state machine shared by the browser facade and its tests. */
export function createMdiCoreRuntime(initializeBinding) {
  let initialization;
  let initialized = false;

  return {
    initialize() {
      if (initialization) return initialization;
      initialization = Promise.resolve().then(initializeBinding).then(() => {
        initialized = true;
      }).catch((error) => {
        initialization = undefined;
        throw error;
      });
      return initialization;
    },
    requireInitialized() {
      if (!initialized) throw new MdiCoreNotInitializedError();
    },
  };
}

export class MdiCoreNotInitializedError extends Error {
  constructor() {
    super("MDI core has not been initialized; await initializeMdiCore() before calling synchronous APIs");
    this.name = "MdiCoreNotInitializedError";
  }
}
