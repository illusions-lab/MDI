/** Pure release selection, shared by the CI calculator and local tests. */
export function stableVersion(value) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`Expected a stable X.Y.Z version, received ${value}`);
  }
  return value.split('.').map(Number);
}

export function nextReleaseVersion({ baseline, published = [], tagged = [], targetVersion, series }) {
  const current = stableVersion(baseline);
  const occupied = new Set([...published, ...tagged]);
  if (targetVersion) {
    const target = stableVersion(targetVersion);
    if (target.some((part) => !Number.isSafeInteger(part))) throw new Error('Version component exceeds safe integer range');
    const comparison = target[0] - current[0] || target[1] - current[1] || target[2] - current[2];
    if (comparison < 0) throw new Error(`Target ${targetVersion} precedes baseline ${baseline}`);
    if (occupied.has(targetVersion)) throw new Error(`Version conflict: ${targetVersion} is already published or tagged`);
    return targetVersion;
  }
  const selected = series ? stableVersion(`${series}.0`).slice(0, 2) : current.slice(0, 2);
  if (selected[0] < current[0] || (selected[0] === current[0] && selected[1] < current[1])) {
    throw new Error(`Release series ${series} precedes baseline ${baseline}`);
  }
  const prefix = `${selected.join('.')}.`;
  const patches = [...occupied].filter((version) => version.startsWith(prefix) && /^\d+$/.test(version.slice(prefix.length))).map((version) => Number(version.slice(prefix.length)));
  // An explicit series can start at .0. Subsequent runs use every occupied
  // registry/tag version, including releases outside the latest dist-tag.
  const floor = series ? (selected[0] === current[0] && selected[1] === current[1] ? current[2] - 1 : -1) : current[2];
  return `${prefix}${Math.max(floor, ...patches) + 1}`;
}

export function releaseClosure(manifests, changedNames) {
  const selected = new Set(changedNames);
  let changed = true;
  while (changed) {
    changed = false;
    for (const manifest of manifests) {
      const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies };
      if (!selected.has(manifest.name) && Object.keys(dependencies).some((name) => selected.has(name))) {
        selected.add(manifest.name);
        changed = true;
      }
    }
  }
  return selected;
}

export const changesPackedArtifacts = (files) => files.includes("nodejs/scripts/pack-publishable-package.mjs");
