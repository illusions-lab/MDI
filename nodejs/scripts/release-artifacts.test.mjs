import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyReleaseVersions, integrity, registryArtifactMatches, validateReleaseManifest, verifyReleaseArtifacts, waitForRegistryArtifact } from './release-artifacts.mjs';

const sha = 'a'.repeat(40);
const artifact = {name:'test-package',version:'2.1.0',filename:'test-package-2.1.0.tgz',integrity:integrity('original artifact')};
const manifest = {version:1,sourceSha:sha,artifacts:[artifact]};
test('recovery verifies the original SHA and bytes before reusing versions',()=>{
  const directory = mkdtempSync(join(tmpdir(),'mdi-release-test-'));
  try {
    writeFileSync(join(directory,artifact.filename),'original artifact');
    assert.equal(verifyReleaseArtifacts(manifest,directory,sha),manifest);
    assert.throws(()=>verifyReleaseArtifacts(manifest,directory,'b'.repeat(40)),/candidate SHA/);
    writeFileSync(join(directory,artifact.filename),'replacement artifact');
    assert.throws(()=>verifyReleaseArtifacts(manifest,directory,sha),/integrity mismatch/);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
test('partial publication skips only identical immutable versions',()=>{
  assert.equal(registryArtifactMatches(artifact,undefined),false);
  assert.equal(registryArtifactMatches(artifact,artifact.integrity),true);
  assert.throws(()=>registryArtifactMatches(artifact,integrity('foreign')),/conflict/);
  assert.throws(()=>validateReleaseManifest({...manifest,artifacts:[artifact,artifact]},sha),/Duplicate/);
  assert.throws(()=>validateReleaseManifest({...manifest,artifacts:[{...artifact,filename:'../artifact.tgz'}]},sha),/filename/);
});
test('replay validates the complete package set before changing any manifest',()=>{
  const directory = mkdtempSync(join(tmpdir(),'mdi-release-test-'));
  try {
    const manifestPath=join(directory,'package.json');
    const baseline={name:artifact.name,version:'2.0.9'};
    writeFileSync(manifestPath,JSON.stringify(baseline));
    assert.throws(()=>applyReleaseVersions({...manifest,artifacts:[artifact,{...artifact,name:'unknown'}]},[{manifestPath,manifest:baseline}]),/Unknown/);
    assert.equal(JSON.parse(readFileSync(manifestPath)).version,'2.0.9');
    applyReleaseVersions(manifest,[{manifestPath,manifest:baseline}]);
    applyReleaseVersions(manifest,[{manifestPath,manifest:baseline}]);
    assert.equal(JSON.parse(readFileSync(manifestPath)).version,'2.1.0');
  } finally { rmSync(directory,{recursive:true,force:true}); }
});

test('publication tolerates delayed registry visibility without repeating an upload', async () => {
  let reads = 0;
  const delays = [];
  await waitForRegistryArtifact(artifact, () => ++reads < 3 ? undefined : artifact.integrity,
    { attempts: 3, delayMs: 10, sleep: async (ms) => delays.push(ms) });
  assert.equal(reads, 3);
  assert.deepEqual(delays, [10, 10]);
});
test('registry polling fails closed on conflicts, lookup errors, and exhaustion', async () => {
  let sleeps = 0;
  const options = { attempts: 2, sleep: async () => { sleeps += 1; } };
  await assert.rejects(waitForRegistryArtifact(artifact, () => integrity('foreign'), options), /conflict/);
  await assert.rejects(waitForRegistryArtifact(artifact, () => { throw new Error('registry offline'); }, options), /registry offline/);
  assert.equal(sleeps, 0);
  await assert.rejects(waitForRegistryArtifact(artifact, () => undefined, options), /not yet visible/);
  assert.equal(sleeps, 1);
});

test('waits for delayed registry visibility without publishing again', async () => {
  let queries = 0;
  let sleeps = 0;
  await waitForRegistryArtifact(artifact, () => ++queries < 3 ? undefined : artifact.integrity, {
    attempts: 3, delayMs: 5, sleep: async delay => { assert.equal(delay, 5); sleeps += 1; },
  });
  assert.equal(queries, 3);
  assert.equal(sleeps, 2);
});

test('registry waiting is bounded and rejects conflicting bytes immediately', async () => {
  let queries = 0;
  await assert.rejects(waitForRegistryArtifact(artifact, () => { queries += 1; return undefined; }, {
    attempts: 2, sleep: async () => {},
  }), /did not become visible/);
  assert.equal(queries, 2);
  await assert.rejects(waitForRegistryArtifact(artifact, () => integrity('foreign bytes'), {
    sleep: async () => assert.fail('conflicts must not wait'),
  }), /conflict/);
});
