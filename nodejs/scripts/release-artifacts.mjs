import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { stableVersion } from './release-version-policy.mjs';

export const integrity = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

export function validateReleaseManifest(manifest, sourceSha) {
  if (manifest.version !== 1 || manifest.sourceSha !== sourceSha || !/^[a-f0-9]{40}$/.test(sourceSha)) {
    throw new Error('Release manifest does not match the verified candidate SHA');
  }
  if (!Array.isArray(manifest.artifacts)) throw new Error('Release manifest must contain artifacts');
  const names = new Set();
  const files = new Set();
  for (const artifact of manifest.artifacts) {
    stableVersion(artifact.version);
    if (typeof artifact.name !== 'string' || names.has(artifact.name)) throw new Error('Duplicate or invalid package in release manifest');
    if (typeof artifact.filename !== 'string' || basename(artifact.filename) !== artifact.filename || !artifact.filename.endsWith('.tgz') || files.has(artifact.filename)) {
      throw new Error('Invalid or duplicate artifact filename');
    }
    if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(artifact.integrity)) throw new Error('Missing artifact integrity');
    names.add(artifact.name);
    files.add(artifact.filename);
  }
  return manifest;
}

export function verifyReleaseArtifacts(manifest, directory, sourceSha) {
  validateReleaseManifest(manifest, sourceSha);
  for (const artifact of manifest.artifacts) {
    if (integrity(readFileSync(join(directory, artifact.filename))) !== artifact.integrity) {
      throw new Error(`Artifact integrity mismatch: ${artifact.name}@${artifact.version}`);
    }
  }
  return manifest;
}

export function registryArtifactMatches(artifact, registryIntegrity) {
  if (registryIntegrity === undefined) return false;
  if (registryIntegrity !== artifact.integrity) throw new Error(`Published artifact conflict: ${artifact.name}@${artifact.version}`);
  return true;
}

export function applyReleaseVersions(manifest, packages) {
  const updates = manifest.artifacts.map((artifact) => {
    const entry = packages.find(({ manifest: value }) => value.name === artifact.name && !value.private);
    if (!entry) throw new Error(`Unknown public package in release manifest: ${artifact.name}`);
    return { ...entry, version: artifact.version };
  });
  for (const {manifest: value, manifestPath, version} of updates) {
    writeFileSync(manifestPath, `${JSON.stringify({...value, version}, null, 2)}\n`);
  }
}
